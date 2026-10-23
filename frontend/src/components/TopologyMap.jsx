import React, { useState, useMemo } from 'react';
import {
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';

function getCableSpec(cable) {
  const raw = `${cable?.capacity || ''} ${cable?.name || ''}`.toUpperCase();
  if (raw.includes('48C')) {
    return {
      layerKey: 'cable48',
      shortLabel: '48C/4T',
      fullLabel: 'Kabel FO 48C/4T',
      color: '#aa00ff',
      colorLabel: 'Ungu (#AA00FF)'
    };
  }
  if (raw.includes('36C')) {
    return {
      layerKey: 'cable36',
      shortLabel: '36C/3T',
      fullLabel: 'Kabel FO 36C/3T',
      color: '#ff00ff',
      colorLabel: 'Magenta (#FF00FF)'
    };
  }
  return {
    layerKey: 'cable24',
    shortLabel: '24C/2T',
    fullLabel: 'Kabel FO 24C/2T',
    color: '#00ff00',
    colorLabel: 'Hijau (#00FF00)'
  };
}

export default function TopologyMap({ project }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedFdt, setSelectedFdt] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState(null);

  const [layers, setLayers] = useState({
    boundary: true,
    cable24: true,
    cable36: true,
    cable48: true,
    slingWires: true,
    poles: true,
    homepasses: true,
    fats: true,
    fdts: true
  });

  const geoData = useMemo(() => {
    if (!project) return null;

    let clusterBoundary = [];
    try {
      clusterBoundary = JSON.parse(project.boundaryCoordsJson || '[]');
    } catch {
      clusterBoundary = [];
    }

    const fdts = (project.fdts || []).filter(
      (f) => selectedFdt === 'ALL' || f.sheetName === selectedFdt
    );

    const fats = [];
    const homepasses = [];
    const cables = [];
    const slingWires = [];
    const fatBoundaries = [];

    for (const fdt of fdts) {
      let fdtRoutes = [];
      try {
        fdtRoutes = JSON.parse(fdt.cableRoutesJson || '[]');
      } catch {
        fdtRoutes = [];
      }
      for (const c of fdtRoutes) {
        const isSling =
          c.routeType === 'SLING_WIRE' ||
          String(c.capacity || '').toUpperCase().includes('SLING') ||
          /^SW\s*\d+/i.test(String(c.name || '').trim());
        if (isSling) {
          slingWires.push({ ...c, sheetName: fdt.sheetName, fdtId: fdt.fdtId });
        } else {
          const spec = getCableSpec(c);
          cables.push({
            ...c,
            capacity: spec.shortLabel,
            cableSpec: spec,
            sheetName: fdt.sheetName,
            fdtId: fdt.fdtId
          });
        }
      }
      for (const fat of fdt.fats || []) {
        fats.push({ ...fat, sheetName: fdt.sheetName });
        if (fat.boundaryJson) {
          try {
            const bCoords = JSON.parse(fat.boundaryJson);
            if (Array.isArray(bCoords) && bCoords.length > 0) {
              fatBoundaries.push({ fatCode: fat.fatCode, coords: bCoords });
            }
          } catch {
            // ignore
          }
        }
        for (const hp of fat.homepasses || []) {
          homepasses.push({
            ...hp,
            fatCode: fat.fatCode,
            lineName: fat.lineName,
            sheetName: fdt.sheetName
          });
        }
      }
    }

    const activeFdtIndices = new Set(fdts.map((f) => f.fdtIndex));
    const poles = (project.poles || []).filter(
      (p) => selectedFdt === 'ALL' || activeFdtIndices.has(p.fdtIndex)
    );

    // Compute bounding box from all coordinates
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    const addCoord = (lat, lon) => {
      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;
      if (lat === 0 && lon === 0) return;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    };

    fdts.forEach((f) => addCoord(f.latitude, f.longitude));
    fats.forEach((f) => addCoord(f.latitude, f.longitude));
    poles.forEach((p) => addCoord(p.latitude, p.longitude));
    homepasses.forEach((h) => addCoord(h.latitude, h.longitude));
    cables.forEach((c) =>
      (c.coords || []).forEach((pt) => addCoord(pt.lat ?? pt.latitude, pt.lon ?? pt.longitude))
    );
    slingWires.forEach((s) =>
      (s.coords || []).forEach((pt) => addCoord(pt.lat ?? pt.latitude, pt.lon ?? pt.longitude))
    );

    if (!isFinite(minLat)) {
      minLat = 0.68;
      maxLat = 0.7;
      minLon = 124.3;
      maxLon = 124.32;
    }

    const padLat = (maxLat - minLat) * 0.08 || 0.002;
    const padLon = (maxLon - minLon) * 0.08 || 0.002;

    const count24 = cables.filter((c) => c.cableSpec.layerKey === 'cable24').length;
    const count36 = cables.filter((c) => c.cableSpec.layerKey === 'cable36').length;
    const count48 = cables.filter((c) => c.cableSpec.layerKey === 'cable48').length;

    return {
      fdts,
      fats,
      poles,
      homepasses,
      cables,
      count24,
      count36,
      count48,
      slingWires,
      clusterBoundary,
      fatBoundaries,
      bounds: {
        minLat: minLat - padLat,
        maxLat: maxLat + padLat,
        minLon: minLon - padLon,
        maxLon: maxLon + padLon
      }
    };
  }, [project, selectedFdt]);

  if (!geoData) return null;

  const WIDTH = 1100;
  const HEIGHT = 620;
  const { minLat, maxLat, minLon, maxLon } = geoData.bounds;

  const projectPoint = (lat, lon) => {
    const x = ((lon - minLon) / (maxLon - minLon || 1)) * WIDTH;
    const y = HEIGHT - ((lat - minLat) / (maxLat - minLat || 1)) * HEIGHT;
    return [x, y];
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const lineColors = {
    'Line A': '#38bdf8',
    'Line B': '#fbbf24',
    'Line C': '#34d399',
    'Line D': '#c084fc'
  };

  // Dynamic toolbar items adapting to whichever cable capacities exist in this KMZ
  const cableLayerButtons = [
    geoData.count24 > 0 && {
      key: 'cable24',
      label: `Kabel 24C/2T (${geoData.count24})`,
      color: '#00ff00',
      activeClass: 'bg-[#00ff00]/15 border-[#00ff00]/60 text-[#00ff00] font-bold shadow-sm'
    },
    geoData.count36 > 0 && {
      key: 'cable36',
      label: `Kabel 36C/3T (${geoData.count36})`,
      color: '#ff00ff',
      activeClass: 'bg-[#ff00ff]/15 border-[#ff00ff]/60 text-[#ff00ff] font-bold shadow-sm'
    },
    geoData.count48 > 0 && {
      key: 'cable48',
      label: `Kabel 48C/4T (${geoData.count48})`,
      color: '#aa00ff',
      activeClass: 'bg-[#aa00ff]/15 border-[#aa00ff]/60 text-[#c77dff] font-bold shadow-sm'
    }
  ].filter(Boolean);

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
            <MapIcon className="w-4 h-4" />
            <span>Peta Topologi GIS KMZ — {project.clusterName}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedFdt('ALL')}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                selectedFdt === 'ALL'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua FDT
            </button>
            {(project.fdts || []).map((fdt) => (
              <button
                key={fdt.id}
                onClick={() => setSelectedFdt(fdt.sheetName)}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  selectedFdt === fdt.sheetName
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {fdt.sheetName}
              </button>
            ))}
          </div>
        </div>

        {/* Layer Toggles & Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'boundary', label: 'Boundary FAT' },
            ...cableLayerButtons,
            {
              key: 'slingWires',
              label: `Kabel Sling (${geoData.slingWires.length})`,
              color: '#00ffff',
              activeClass: 'bg-[#00ffff]/15 border-[#00ffff]/60 text-[#00ffff] font-bold shadow-sm'
            },
            { key: 'poles', label: `Tiang (${geoData.poles.length})` },
            { key: 'homepasses', label: `Homepass (${geoData.homepasses.length})` },
            {
              key: 'fats',
              label: `FAT (${geoData.fats.length})`,
              color: '#ffff00',
              isDot: true,
              activeClass: 'bg-[#ffff00]/15 border-[#ffff00]/60 text-[#ffff00] font-bold shadow-sm'
            },
            { key: 'fdts', label: `FDT (${geoData.fdts.length})` }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setLayers((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition flex items-center gap-1.5 ${
                layers[item.key]
                  ? item.activeClass || 'bg-slate-800 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              {item.color && (
                <span
                  className={
                    item.isDot
                      ? 'w-2 h-2 rounded-full inline-block'
                      : 'w-2.5 h-0.5 rounded-full inline-block'
                  }
                  style={{ backgroundColor: layers[item.key] ? item.color : '#64748b' }}
                />
              )}
              <span>{item.label}</span>
            </button>
          ))}

          <div className="flex items-center gap-1 ml-2 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.35, 8))}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
              title="Perbesar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z / 1.35, 0.6))}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
              title="Perkecil"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
              title="Reset Posisi"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative bg-[#070d19] overflow-hidden h-[580px] select-none">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Cluster & FAT Boundaries */}
            {layers.boundary &&
              Array.isArray(geoData.clusterBoundary) &&
              geoData.clusterBoundary.length > 2 && (
                <polygon
                  points={geoData.clusterBoundary
                    .map((c) => projectPoint(c.lat ?? c.latitude, c.lon ?? c.longitude).join(','))
                    .join(' ')}
                  fill="rgba(14, 165, 233, 0.04)"
                  stroke="#0284c7"
                  strokeWidth={1.2 / zoom}
                  strokeDasharray={`${4 / zoom},${3 / zoom}`}
                />
              )}

            {layers.boundary &&
              geoData.fatBoundaries.map((poly, idx) => {
                const pts = (poly.coords || [])
                  .map((c) => projectPoint(c.lat ?? c.latitude, c.lon ?? c.longitude).join(','))
                  .join(' ');
                return (
                  <polygon
                    key={`fb-${idx}`}
                    points={pts}
                    fill="rgba(16, 185, 129, 0.05)"
                    stroke="#10b981"
                    strokeOpacity={0.35}
                    strokeWidth={0.8 / zoom}
                  />
                );
              })}

            {/* 2. Distribution Cable Routes per Line Capacity:
                24C/2T = Hijau (#00ff00), 36C/3T = Magenta (#ff00ff), 48C/4T = Ungu (#aa00ff) */}
            {geoData.cables.map((cable, idx) => {
              const spec = cable.cableSpec || getCableSpec(cable);
              if (!layers[spec.layerKey]) return null;
              const pts = (cable.coords || cable.coordinates || [])
                .map((c) => projectPoint(c.lat ?? c.latitude, c.lon ?? c.longitude).join(','))
                .join(' ');
              return (
                <g
                  key={`cab-${idx}`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    const firstPt = (cable.coords || [])[0] || { lat: 0, lon: 0 };
                    setSelectedItem({
                      type: `KABEL DISTRIBUSI (${spec.shortLabel})`,
                      title: cable.name || `${spec.fullLabel} — ${cable.lineName}`,
                      subtitle: `Tipe Kabel: ${spec.shortLabel} (${spec.colorLabel}) • Panjang Rute: ${cable.routeM || 0} m`,
                      fdt: `${cable.sheetName} (${cable.fdtId || ''}) • ${cable.lineName}`,
                      lat: firstPt.lat ?? firstPt.latitude ?? 0,
                      lon: firstPt.lon ?? firstPt.longitude ?? 0
                    });
                  }}
                >
                  {/* Subtle glow matching cable capacity color */}
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={spec.color}
                    strokeOpacity={0.24}
                    strokeWidth={5 / zoom}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Main cable polyline */}
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={spec.color}
                    strokeWidth={2.4 / zoom}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* 2B. Sling Wire Routes (#00ffff Light Blue / Cyan) */}
            {layers.slingWires &&
              geoData.slingWires.map((sw, idx) => {
                const coordsArr = sw.coords || sw.coordinates || [];
                const pts = coordsArr
                  .map((c) => projectPoint(c.lat ?? c.latitude, c.lon ?? c.longitude).join(','))
                  .join(' ');
                return (
                  <g
                    key={`sw-${idx}`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const firstPt = coordsArr[0] || { lat: 0, lon: 0 };
                      setSelectedItem({
                        type: 'KABEL SLING (SLING WIRE)',
                        title: sw.name || `SW ${sw.routeM || 0} M`,
                        subtitle: `Panjang Segmen: ${sw.routeM || 0} m • Warna Layer: #00FFFF`,
                        fdt: `${sw.sheetName} (${sw.fdtId || ''}) • ${sw.lineName}`,
                        lat: firstPt.lat ?? firstPt.latitude ?? 0,
                        lon: firstPt.lon ?? firstPt.longitude ?? 0
                      });
                    }}
                  >
                    {/* Subtle outer glow for #00ffff visibility */}
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="#00ffff"
                      strokeOpacity={0.28}
                      strokeWidth={5.2 / zoom}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Core #00ffff Sling Wire Line */}
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="#00ffff"
                      strokeWidth={2.5 / zoom}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}

            {/* 3. Poles */}
            {layers.poles &&
              geoData.poles.map((pole) => {
                const [x, y] = projectPoint(pole.latitude, pole.longitude);
                const isExisting = String(pole.poleCategory || '').includes('EXISTING');
                return (
                  <circle
                    key={pole.id}
                    cx={x}
                    cy={y}
                    r={2.5 / zoom}
                    fill={isExisting ? '#c084fc' : '#94a3b8'}
                    stroke="#0f172a"
                    strokeWidth={0.6 / zoom}
                    className="cursor-pointer hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem({
                        type: 'TIANG (POLE)',
                        title: pole.poleId,
                        subtitle: pole.poleCategory,
                        fdt: `FDT ${pole.fdtIndex} • ${pole.lineName}`,
                        lat: pole.latitude,
                        lon: pole.longitude
                      });
                    }}
                  />
                );
              })}

            {/* 4. Homepasses */}
            {layers.homepasses &&
              geoData.homepasses.map((hp) => {
                const [x, y] = projectPoint(hp.latitude, hp.longitude);
                const color = lineColors[hp.lineName] || '#cbd5e1';
                return (
                  <circle
                    key={hp.id}
                    cx={x}
                    cy={y}
                    r={2.1 / zoom}
                    fill={color}
                    fillOpacity={0.85}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem({
                        type: 'HOMEPASS (HP COVER)',
                        title: `No. Rumah: ${hp.homeNumber}`,
                        subtitle: `FAT: ${hp.fatCode} • Port #${hp.fatPort}`,
                        fdt: `${hp.sheetName} • ${hp.lineName}`,
                        lat: hp.latitude,
                        lon: hp.longitude
                      });
                    }}
                  />
                );
              })}

            {/* 5. FAT Nodes — Kuning (#ffff00) */}
            {layers.fats &&
              geoData.fats.map((fat) => {
                const [x, y] = projectPoint(fat.latitude, fat.longitude);
                return (
                  <g
                    key={fat.id}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem({
                        type: 'FAT (FIBER ACCESS TERMINAL)',
                        title: `${fat.fatCode} (${fat.fullFatName})`,
                        subtitle: `Kapasitas Line: ${fat.lineCapacity || '24C/2T'} • Pole ID: ${fat.poleId} • Tray ${fat.fdtTray} • Tube ${fat.tubeColour} (Core ${fat.coreNumber1}-${fat.coreNumber2})`,
                        fdt: `${fat.sheetName} • ${fat.lineName} • ${(fat.homepasses || []).length} Homepass`,
                        lat: fat.latitude,
                        lon: fat.longitude
                      });
                    }}
                  >
                    <polygon
                      points={`0,${-6 / zoom} ${5.5 / zoom},${4.5 / zoom} ${-5.5 / zoom},${4.5 / zoom}`}
                      fill="#ffff00"
                      stroke="#0f172a"
                      strokeWidth={1.1 / zoom}
                    />
                    <text
                      y={-8 / zoom}
                      textAnchor="middle"
                      fill="#ffff00"
                      fontSize={8 / zoom}
                      fontWeight="bold"
                    >
                      {fat.fatCode}
                    </text>
                  </g>
                );
              })}

            {/* 6. FDT Nodes */}
            {layers.fdts &&
              geoData.fdts.map((fdt) => {
                const [x, y] = projectPoint(fdt.latitude, fdt.longitude);
                const routeSum =
                  (fdt.routeLineA24 || 0) +
                  (fdt.routeLineB24 || 0) +
                  (fdt.routeLineC24 || 0) +
                  (fdt.routeLineD24 || 0) +
                  (fdt.routeLineA36 || 0) +
                  (fdt.routeLineB36 || 0) +
                  (fdt.routeLineC36 || 0) +
                  (fdt.routeLineD36 || 0) +
                  (fdt.routeLineA48 || 0) +
                  (fdt.routeLineB48 || 0) +
                  (fdt.routeLineC48 || 0) +
                  (fdt.routeLineD48 || 0);
                return (
                  <g
                    key={fdt.id}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem({
                        type: 'FDT (FIBER DISTRIBUTION TERMINAL)',
                        title: `${fdt.sheetName} — ${fdt.fdtId}`,
                        subtitle: `Route FO: ${routeSum}m • Sling Wire: ${fdt.slingWireRouteM}m`,
                        fdt: `Total FAT: ${fdt.totalFat} Unit • Total HP: ${fdt.totalHp} HP`,
                        lat: fdt.latitude,
                        lon: fdt.longitude
                      });
                    }}
                  >
                    <rect
                      x={-8 / zoom}
                      y={-8 / zoom}
                      width={16 / zoom}
                      height={16 / zoom}
                      rx={3 / zoom}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                    />
                    <text
                      y={-11 / zoom}
                      textAnchor="middle"
                      fill="#fecaca"
                      fontSize={10 / zoom}
                      fontWeight="bold"
                    >
                      {fdt.sheetName} ({fdt.fdtId})
                    </text>
                  </g>
                );
              })}
          </g>
        </svg>

        {/* Bottom-left Legend */}
        <div className="absolute bottom-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 shadow-xl space-y-1.5">
          <div className="font-bold text-white text-xs mb-1">Legenda Elemen Jaringan KMZ</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-red-500 border border-white inline-block" />
            <span>FDT (Fiber Distribution Terminal)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-slate-950 inline-block"
              style={{ backgroundColor: '#ffff00', boxShadow: '0 0 6px #ffff00' }}
            />
            <span className="font-semibold text-[#ffff00]">
              FAT (Fiber Access Terminal #FFFF00) + Snapped Pole
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-1 rounded-full inline-block"
                style={{ backgroundColor: '#00ff00', boxShadow: '0 0 5px #00ff00' }}
              />
              <span className="font-semibold text-[#00ff00]">FO 24C/2T (#00FF00)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-1 rounded-full inline-block"
                style={{ backgroundColor: '#ff00ff', boxShadow: '0 0 5px #ff00ff' }}
              />
              <span className="font-semibold text-[#ff00ff]">FO 36C/3T (#FF00FF)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-1 rounded-full inline-block"
                style={{ backgroundColor: '#aa00ff', boxShadow: '0 0 5px #aa00ff' }}
              />
              <span className="font-semibold text-[#c77dff]">FO 48C/4T (#AA00FF)</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-1 rounded-full inline-block"
              style={{ backgroundColor: '#00ffff', boxShadow: '0 0 6px #00ffff' }}
            />
            <span className="font-semibold text-[#00ffff]">Kabel Sling (Sling Wire #00FFFF)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
            <span>HP Line A</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ml-1" />
            <span>HP Line B</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block ml-1" />
            <span>HP Line C</span>
          </div>
        </div>

        {/* Selected Node Details Card */}
        {selectedItem && (
          <div className="absolute top-3 right-3 w-80 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                {selectedItem.type}
              </span>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="text-sm font-bold text-white">{selectedItem.title}</div>
            <div className="text-slate-300 mt-1">{selectedItem.subtitle}</div>
            <div className="text-slate-400 mt-1">{selectedItem.fdt}</div>
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between font-mono text-[11px] text-emerald-400">
              <span>LAT: {Number(selectedItem.lat).toFixed(6)}</span>
              <span>LON: {Number(selectedItem.lon).toFixed(6)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
