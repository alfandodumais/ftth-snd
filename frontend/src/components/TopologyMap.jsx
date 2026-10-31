import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe,
  Layers,
  Compass,
  Maximize2,
  Minimize2,
  Ruler,
  ExternalLink,
  Eye,
  Tag,
  Sun,
  Navigation
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

// Web Mercator (EPSG:3857) exact conversions for 1:1 Top-Down Google Earth alignment
function lonToU(lon) {
  return (lon + 180) / 360;
}

function latToV(lat) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

function uToLon(u) {
  return u * 360 - 180;
}

function vToLat(v) {
  const n = Math.PI - 2 * Math.PI * v;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Haversine distance in meters between two GPS coordinates
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTileUrl(mapMode, z, x, y, useFallback = false) {
  if (useFallback) {
    if (mapMode === 'street') {
      return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    }
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  const serverIdx = Math.abs(x + y) % 4;
  if (mapMode === 'hybrid') {
    // Google Earth Hybrid (Satellite + Road & Place Labels from above)
    return `https://mt${serverIdx}.google.com/vt/lyrs=y&hl=id&x=${x}&y=${y}&z=${z}`;
  }
  if (mapMode === 'satellite') {
    // Google Earth Pure Satellite (Top-Down Overhead)
    return `https://mt${serverIdx}.google.com/vt/lyrs=s&hl=id&x=${x}&y=${y}&z=${z}`;
  }
  if (mapMode === 'street') {
    // Google Street / Terrain Map
    return `https://mt${serverIdx}.google.com/vt/lyrs=m&hl=id&x=${x}&y=${y}&z=${z}`;
  }
  return '';
}

export default function TopologyMap({ project }) {
  const WIDTH = 1100;
  const HEIGHT = 640;

  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedFdt, setSelectedFdt] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState(null);

  // Google Earth Top-Down & View Controls
  // 'hybrid' = Google Earth Satelit + Label Jalan (Default), 'satellite' = Satelit Murni, 'street' = Peta Jalan, 'cad' = Skematik Gelap
  const [mapMode, setMapMode] = useState('hybrid');
  // 'TOP_DOWN' = 90° Tegak Lurus Dari Atas (Default seperti Google Earth Top-Down), 'TILT_3D' = Perspektif Miring 3D
  const [cameraPitch, setCameraPitch] = useState('TOP_DOWN');
  const [rotation, setRotation] = useState(0);
  const [satBrightness, setSatBrightness] = useState(0.88);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tileFallback, setTileFallback] = useState(false);

  // Interactive Distance Measurement (Ruler ala Google Earth)
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [cursorGps, setCursorGps] = useState(null);

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
    fatBoundaries.forEach((fb) =>
      (fb.coords || []).forEach((pt) => addCoord(pt.lat ?? pt.latitude, pt.lon ?? pt.longitude))
    );

    if (!isFinite(minLat)) {
      minLat = -0.901;
      maxLat = -0.895;
      minLon = 119.865;
      maxLon = 119.872;
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // Web Mercator 1:1 bounds so top-down view has exact 1:1 geographic aspect ratio
    const uMin = lonToU(minLon);
    const uMax = lonToU(maxLon);
    const vMin = latToV(maxLat); // North has smaller v
    const vMax = latToV(minLat); // South has larger v

    const u0 = (uMin + uMax) / 2;
    const v0 = (vMin + vMax) / 2;

    const spanU = Math.max(uMax - uMin, 1e-6);
    const spanV = Math.max(vMax - vMin, 1e-6);

    // Fit cluster inside WIDTH x HEIGHT with 18% margin while preserving 1:1 Web Mercator scale
    const padFactor = 1.18;
    const worldSize = Math.min(WIDTH / (spanU * padFactor), HEIGHT / (spanV * padFactor));
    const zFit = Math.log2(worldSize / 256);

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
      centerLat,
      centerLon,
      u0,
      v0,
      uMin,
      uMax,
      vMin,
      vMax,
      worldSize,
      zFit
    };
  }, [project, selectedFdt]);

  const projectPoint = useCallback(
    (lat, lon) => {
      if (!geoData) return [0, 0];
      const u = lonToU(lon);
      const v = latToV(lat);
      const x = WIDTH / 2 + (u - geoData.u0) * geoData.worldSize;
      const y = HEIGHT / 2 + (v - geoData.v0) * geoData.worldSize;
      return [x, y];
    },
    [geoData]
  );

  const unprojectPoint = useCallback(
    (x, y) => {
      if (!geoData) return { lat: 0, lon: 0 };
      const u = geoData.u0 + (x - WIDTH / 2) / geoData.worldSize;
      const v = geoData.v0 + (y - HEIGHT / 2) / geoData.worldSize;
      return { lat: vToLat(v), lon: uToLon(u) };
    },
    [geoData]
  );

  // Zoom around a specific SVG viewBox focal point (cx, cy)
  const zoomAroundPoint = useCallback(
    (factor, cx = WIDTH / 2, cy = HEIGHT / 2) => {
      setZoom((prevZoom) => {
        const nextZoom = Math.min(Math.max(prevZoom * factor, 0.5), 28);
        setPan((prevPan) => {
          const localX = (cx - prevPan.x) / prevZoom;
          const localY = (cy - prevPan.y) / prevZoom;
          return {
            x: cx - localX * nextZoom,
            y: cy - localY * nextZoom
          };
        });
        return nextZoom;
      });
    },
    []
  );

  // Native wheel listener (passive: false) for smooth Google Earth cursor-centered scroll zoom
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const rect = svgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const cy = ((e.clientY - rect.top) / rect.height) * HEIGHT;
      const factor = e.deltaY < 0 ? 1.25 : 1 / 1.25;
      zoomAroundPoint(factor, cx, cy);
    };

    svgEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => svgEl.removeEventListener('wheel', handleWheel);
  }, [zoomAroundPoint]);

  // Sync fullscreen state with browser fullscreen events
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {
        setIsFullscreen((prev) => !prev);
      });
    } else {
      document.exitFullscreen?.().catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Compute Web Mercator Satellite / Street Tiles aligned to the exact SVG coordinate system
  const tileLayers = useMemo(() => {
    if (!geoData || mapMode === 'cad') return { baseTiles: [], detailTiles: [], activeZ: 16 };

    const { u0, v0, worldSize, zFit, uMin, uMax, vMin, vMax } = geoData;

    const buildTileGrid = (targetZ, uLeft, uRight, vTop, vBottom, maxCount = 56) => {
      let z = Math.min(20, Math.max(11, Math.round(targetZ)));
      while (z > 11) {
        const n = Math.pow(2, z);
        const txMin = Math.max(0, Math.floor(uLeft * n));
        const txMax = Math.min(n - 1, Math.floor(uRight * n));
        const tyMin = Math.max(0, Math.floor(vTop * n));
        const tyMax = Math.min(n - 1, Math.floor(vBottom * n));
        const count = (txMax - txMin + 1) * (tyMax - tyMin + 1);
        if (count <= maxCount) {
          const tiles = [];
          const size = worldSize / n;
          for (let tx = txMin; tx <= txMax; tx++) {
            for (let ty = tyMin; ty <= tyMax; ty++) {
              const x = WIDTH / 2 + (tx / n - u0) * worldSize;
              const y = HEIGHT / 2 + (ty / n - v0) * worldSize;
              tiles.push({
                key: `${z}-${tx}-${ty}`,
                z,
                tx,
                ty,
                x,
                y,
                size
              });
            }
          }
          return { z, tiles };
        }
        z--;
      }
      return { z, tiles: [] };
    };

    // 1. Base overview tiles covering the cluster bounds so zooming never flashes blank
    const padU = (uMax - uMin) * 0.45;
    const padV = (vMax - vMin) * 0.45;
    const baseGrid = buildTileGrid(
      Math.min(18, Math.floor(zFit)),
      uMin - padU,
      uMax + padU,
      vMin - padV,
      vMax + padV,
      36
    );

    // 2. High-resolution detail tiles for the currently visible viewport
    const marginX = WIDTH * 0.25;
    const marginY = HEIGHT * 0.25;
    const xMin = (-marginX - pan.x) / zoom;
    const xMax = (WIDTH + marginX - pan.x) / zoom;
    const yMin = (-marginY - pan.y) / zoom;
    const yMax = (HEIGHT + marginY - pan.y) / zoom;

    const uVisMin = u0 + (xMin - WIDTH / 2) / worldSize;
    const uVisMax = u0 + (xMax - WIDTH / 2) / worldSize;
    const vVisMin = v0 + (yMin - HEIGHT / 2) / worldSize;
    const vVisMax = v0 + (yMax - HEIGHT / 2) / worldSize;

    const zEff = zFit + Math.log2(zoom);
    const detailGrid = buildTileGrid(zEff, uVisMin, uVisMax, vVisMin, vVisMax, 56);

    return {
      baseTiles: detailGrid.z === baseGrid.z ? [] : baseGrid.tiles,
      detailTiles: detailGrid.tiles,
      activeZ: detailGrid.z
    };
  }, [geoData, mapMode, pan.x, pan.y, zoom]);

  // Compute dynamic scale bar in meters (top-down real-world distance)
  const scaleBarInfo = useMemo(() => {
    if (!geoData) return { label: '100 m', pxWidth: 80 };
    const latRad = (geoData.centerLat * Math.PI) / 180;
    // Circumference at centerLat in meters = 40075016.686 * cos(lat)
    const metersPerWorld = 40075016.686 * Math.cos(latRad);
    const metersPerSvgPx = metersPerWorld / (geoData.worldSize * zoom);
    const targetMeters = metersPerSvgPx * 90;
    const niceSteps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const chosenMeters =
      niceSteps.find((s) => s >= targetMeters) || niceSteps[niceSteps.length - 1];
    const pxWidth = Math.max(40, Math.min(140, chosenMeters / metersPerSvgPx));
    const label = chosenMeters >= 1000 ? `${chosenMeters / 1000} km` : `${chosenMeters} m`;
    return { label, pxWidth };
  }, [geoData, zoom]);

  // Compute total measured distance in meters
  const totalMeasuredMeters = useMemo(() => {
    if (measurePoints.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < measurePoints.length; i++) {
      sum += haversineMeters(
        measurePoints[i - 1].lat,
        measurePoints[i - 1].lon,
        measurePoints[i].lat,
        measurePoints[i].lon
      );
    }
    return sum;
  }, [measurePoints]);

  if (!geoData) return null;

  const svgPointFromEvent = (e) => {
    const svgEl = svgRef.current;
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const vx = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const vy = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const lx = (vx - pan.x) / zoom;
    const ly = (vy - pan.y) / zoom;
    return { vx, vy, lx, ly };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y, rawX: e.clientX, rawY: e.clientY });
  };

  const handleMouseMove = (e) => {
    const pt = svgPointFromEvent(e);
    if (pt) {
      setCursorGps(unprojectPoint(pt.lx, pt.ly));
    }
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = (e) => {
    if (isDragging && measureMode && dragStart.rawX !== undefined) {
      const moved = Math.hypot(e.clientX - dragStart.rawX, e.clientY - dragStart.rawY);
      if (moved < 5) {
        const pt = svgPointFromEvent(e);
        if (pt) {
          const gps = unprojectPoint(pt.lx, pt.ly);
          setMeasurePoints((prev) => [...prev, { ...gps, x: pt.lx, y: pt.ly }]);
        }
      }
    }
    setIsDragging(false);
  };

  const resetViewTopDown = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCameraPitch('TOP_DOWN');
    setRotation(0);
  };

  const openInGoogleEarthWeb = (lat, lon, altitudeM = 450) => {
    const targetLat = Number(lat || geoData.centerLat).toFixed(6);
    const targetLon = Number(lon || geoData.centerLon).toFixed(6);
    // 0t = 0 degree tilt (Directly from above / Top-Down view in Google Earth)
    const url = `https://earth.google.com/web/@${targetLat},${targetLon},${altitudeM}a,550d,35y,0h,0t,0r`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openInGoogleMapsSatellite = (lat, lon) => {
    const targetLat = Number(lat || geoData.centerLat).toFixed(6);
    const targetLon = Number(lon || geoData.centerLon).toFixed(6);
    const url = `https://www.google.com/maps/@?api=1&map_action=map&center=${targetLat},${targetLon}&zoom=19&basemap=satellite`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const lineColors = {
    'Line A': '#38bdf8',
    'Line B': '#fbbf24',
    'Line C': '#34d399',
    'Line D': '#c084fc'
  };

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

  const isSatelliteActive = mapMode === 'hybrid' || mapMode === 'satellite';
  const showDetailNumbers = showAllLabels || zoom >= 3.2;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : ''
      }`}
    >
      {/* Top Bar 1: Google Earth Base Map Switcher, Top-Down View Controls & FDT Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-slate-900 border-b border-slate-800/90">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
            <Globe className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>Peta Topologi Google Earth KMZ — {project.clusterName}</span>
          </div>

          {/* FDT Sheet Selector */}
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

        {/* Mode Peta Google Earth (Dari Atas) & Sudut Kamera */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Base Map Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            {[
              { id: 'hybrid', label: '🛰️ Google Earth (Dari Atas)' },
              { id: 'satellite', label: '🌍 Satelit Murni' },
              { id: 'street', label: '🗺️ Peta Jalan' },
              { id: 'cad', label: '📐 Skematik CAD' }
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMapMode(mode.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  mapMode === mode.id
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Camera Pitch Toggle: 90° Top-Down Overhead vs 3D Tilt */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setCameraPitch('TOP_DOWN');
                setRotation(0);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
                cameraPitch === 'TOP_DOWN'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Tampilan tegak lurus 90° dari atas seperti Google Earth"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Dari Atas (90°)</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraPitch('TILT_3D')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                cameraPitch === 'TILT_3D'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Tampilan miring perspektif 3D"
            >
              <span>3D Tilt (45°)</span>
            </button>
          </div>

          {/* Open directly in Google Earth Web (Top-Down 0° Tilt) */}
          <button
            type="button"
            onClick={() => openInGoogleEarthWeb(geoData.centerLat, geoData.centerLon, 500)}
            className="px-2.5 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-300 text-[11px] font-semibold transition flex items-center gap-1.5"
            title="Buka titik cluster ini di Google Earth Web (Tampilan Dari Atas)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Google Earth</span>
          </button>
        </div>
      </div>

      {/* Top Bar 2: KMZ Layer Toggles, Ruler, Labels, Brightness & Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-950/80 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
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
        </div>

        {/* Tools: Label Nomor Rumah/Tiang, Penggaris Jarak, Kecerahan Satelit, Zoom & Fullscreen */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Toggle House Numbers & Pole IDs on Rooftops */}
          <button
            type="button"
            onClick={() => setShowAllLabels((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 ${
              showAllLabels
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Tampilkan nomor rumah (Homepass) & ID Tiang di atas atap rumah"
          >
            <Tag className="w-3 h-3" />
            <span>No. Rumah &amp; Tiang</span>
          </button>

          {/* Google Earth Ruler / Measure Distance Tool */}
          <button
            type="button"
            onClick={() => {
              setMeasureMode((m) => !m);
              if (measureMode) setMeasurePoints([]);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 ${
              measureMode
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Ukur jarak antar titik dari atas seperti Penggaris Google Earth"
          >
            <Ruler className="w-3 h-3" />
            <span>
              {measureMode
                ? `Ukur: ${totalMeasuredMeters.toFixed(1)} m`
                : 'Ukur Jarak'}
            </span>
          </button>

          {measureMode && measurePoints.length > 0 && (
            <button
              type="button"
              onClick={() => setMeasurePoints([])}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25"
            >
              Reset Ukur
            </button>
          )}

          {/* Satellite Brightness Cycle */}
          {mapMode !== 'cad' && (
            <button
              type="button"
              onClick={() =>
                setSatBrightness((b) => (b >= 0.95 ? 0.55 : b <= 0.6 ? 0.75 : b <= 0.8 ? 0.88 : 1))
              }
              className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1"
              title="Atur kecerahan citra satelit agar garis kabel & atap rumah terlihat kontras"
            >
              <Sun className="w-3 h-3 text-amber-400" />
              <span>{Math.round(satBrightness * 100)}%</span>
            </button>
          )}

          {/* Zoom & Compass Reset Controls */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => zoomAroundPoint(1.4)}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
              title="Perbesar (Atau gunakan Scroll Mouse)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => zoomAroundPoint(1 / 1.4)}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
              title="Perkecil (Atau gunakan Scroll Mouse)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetViewTopDown}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
              title="Reset Posisi Tegak Lurus Dari Atas (Utara 90°)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (Fullscreen)'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Map Viewport */}
      <div
        className={`relative bg-[#070d19] overflow-hidden select-none ${
          isFullscreen ? 'flex-1' : 'h-[620px]'
        }`}
        style={{
          perspective: cameraPitch === 'TILT_3D' ? '1200px' : 'none'
        }}
      >
        {/* Subtle Technical Grid when in CAD mode */}
        {mapMode === 'cad' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
        )}

        <div
          className="w-full h-full transition-transform duration-300 ease-out"
          style={{
            transform:
              cameraPitch === 'TILT_3D'
                ? `rotateX(42deg) rotateZ(${rotation}deg) scale(1.06)`
                : rotation !== 0
                ? `rotateZ(${rotation}deg)`
                : 'none',
            transformStyle: 'preserve-3d'
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className={`w-full h-full ${
              measureMode
                ? 'cursor-crosshair'
                : isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDragging(false)}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* 0. GOOGLE EARTH SATELLITE / HYBRID / STREET TILES (1:1 TOP-DOWN OVERHEAD) */}
              {mapMode !== 'cad' && (
                <g opacity={satBrightness}>
                  {/* Base overview tiles so zooming never flickers */}
                  {tileLayers.baseTiles.map((tile) => (
                    <image
                      key={`base-${mapMode}-${tile.key}-${tileFallback}`}
                      href={getTileUrl(mapMode, tile.z, tile.tx, tile.ty, tileFallback)}
                      x={tile.x}
                      y={tile.y}
                      width={tile.size + 0.8 / zoom}
                      height={tile.size + 0.8 / zoom}
                      preserveAspectRatio="none"
                      onError={() => {
                        if (!tileFallback) setTileFallback(true);
                      }}
                    />
                  ))}
                  {/* High-res detail tiles for active zoom level */}
                  {tileLayers.detailTiles.map((tile) => (
                    <image
                      key={`det-${mapMode}-${tile.key}-${tileFallback}`}
                      href={getTileUrl(mapMode, tile.z, tile.tx, tile.ty, tileFallback)}
                      x={tile.x}
                      y={tile.y}
                      width={tile.size + 0.6 / zoom}
                      height={tile.size + 0.6 / zoom}
                      preserveAspectRatio="none"
                      onError={() => {
                        if (!tileFallback) setTileFallback(true);
                      }}
                    />
                  ))}
                </g>
              )}

              {/* 1. Cluster & FAT Boundaries */}
              {layers.boundary &&
                Array.isArray(geoData.clusterBoundary) &&
                geoData.clusterBoundary.length > 2 && (
                  <polygon
                    points={geoData.clusterBoundary
                      .map((c) => projectPoint(c.lat ?? c.latitude, c.lon ?? c.longitude).join(','))
                      .join(' ')}
                    fill={isSatelliteActive ? 'rgba(14, 165, 233, 0.08)' : 'rgba(14, 165, 233, 0.04)'}
                    stroke="#38bdf8"
                    strokeWidth={1.6 / zoom}
                    strokeDasharray={`${5 / zoom},${3 / zoom}`}
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
                      fill={
                        isSatelliteActive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.05)'
                      }
                      stroke={isSatelliteActive ? '#34d399' : '#10b981'}
                      strokeOpacity={isSatelliteActive ? 0.85 : 0.45}
                      strokeWidth={1.2 / zoom}
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
                      if (measureMode) return;
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
                    {/* Dark casing when over satellite imagery for high contrast */}
                    {isSatelliteActive && (
                      <polyline
                        points={pts}
                        fill="none"
                        stroke="#020617"
                        strokeOpacity={0.75}
                        strokeWidth={4.4 / zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Subtle glow matching cable capacity color */}
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={spec.color}
                      strokeOpacity={0.28}
                      strokeWidth={5.5 / zoom}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Main cable polyline */}
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={spec.color}
                      strokeWidth={2.5 / zoom}
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
                        if (measureMode) return;
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
                      {isSatelliteActive && (
                        <polyline
                          points={pts}
                          fill="none"
                          stroke="#020617"
                          strokeOpacity={0.75}
                          strokeWidth={4.4 / zoom}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      <polyline
                        points={pts}
                        fill="none"
                        stroke="#00ffff"
                        strokeOpacity={0.3}
                        strokeWidth={5.2 / zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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

              {/* 3. Poles (Tiang) */}
              {layers.poles &&
                geoData.poles.map((pole) => {
                  const [x, y] = projectPoint(pole.latitude, pole.longitude);
                  const isExisting = String(pole.poleCategory || '').includes('EXISTING');
                  return (
                    <g
                      key={pole.id}
                      transform={`translate(${x}, ${y})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        if (measureMode) return;
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
                    >
                      <circle
                        r={2.8 / zoom}
                        fill={isExisting ? '#c084fc' : '#e2e8f0'}
                        stroke="#020617"
                        strokeWidth={0.9 / zoom}
                      />
                      {showDetailNumbers && pole.poleId && (
                        <text
                          y={-4.2 / zoom}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          stroke="#020617"
                          strokeWidth={1.6 / zoom}
                          paintOrder="stroke"
                          fontSize={5.5 / zoom}
                          fontWeight="600"
                        >
                          {pole.poleId}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* 4. Homepasses (Titik Rumah & Nomor Rumah dari Atas) */}
              {layers.homepasses &&
                geoData.homepasses.map((hp) => {
                  const [x, y] = projectPoint(hp.latitude, hp.longitude);
                  const color = lineColors[hp.lineName] || '#cbd5e1';
                  return (
                    <g
                      key={hp.id}
                      transform={`translate(${x}, ${y})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        if (measureMode) return;
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
                    >
                      <circle
                        r={2.4 / zoom}
                        fill={color}
                        stroke="#020617"
                        strokeWidth={0.75 / zoom}
                        fillOpacity={0.92}
                      />
                      {showDetailNumbers && hp.homeNumber && (
                        <text
                          y={-3.8 / zoom}
                          textAnchor="middle"
                          fill="#ffffff"
                          stroke="#020617"
                          strokeWidth={1.8 / zoom}
                          paintOrder="stroke"
                          fontSize={6 / zoom}
                          fontWeight="bold"
                        >
                          {hp.homeNumber}
                        </text>
                      )}
                    </g>
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
                        if (measureMode) return;
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
                        points={`0,${-6.5 / zoom} ${6 / zoom},${4.8 / zoom} ${-6 / zoom},${4.8 / zoom}`}
                        fill="#ffff00"
                        stroke="#020617"
                        strokeWidth={1.3 / zoom}
                      />
                      <text
                        y={-8.5 / zoom}
                        textAnchor="middle"
                        fill="#ffff00"
                        stroke="#020617"
                        strokeWidth={2.5 / zoom}
                        paintOrder="stroke"
                        fontSize={8.5 / zoom}
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
                        if (measureMode) return;
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
                        x={-8.5 / zoom}
                        y={-8.5 / zoom}
                        width={17 / zoom}
                        height={17 / zoom}
                        rx={3 / zoom}
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={1.8 / zoom}
                      />
                      <text
                        y={-11.5 / zoom}
                        textAnchor="middle"
                        fill="#ffffff"
                        stroke="#020617"
                        strokeWidth={3 / zoom}
                        paintOrder="stroke"
                        fontSize={10.5 / zoom}
                        fontWeight="bold"
                      >
                        {fdt.sheetName} ({fdt.fdtId})
                      </text>
                    </g>
                  );
                })}

              {/* 7. Interactive Ruler / Measure Distance Overlay */}
              {measurePoints.length > 0 && (
                <g>
                  {measurePoints.length > 1 && (
                    <polyline
                      points={measurePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2.6 / zoom}
                      strokeDasharray={`${5 / zoom},${3 / zoom}`}
                    />
                  )}
                  {measurePoints.map((pt, idx) => {
                    const segDist =
                      idx > 0
                        ? haversineMeters(
                            measurePoints[idx - 1].lat,
                            measurePoints[idx - 1].lon,
                            pt.lat,
                            pt.lon
                          )
                        : 0;
                    return (
                      <g key={`mp-${idx}`} transform={`translate(${pt.x}, ${pt.y})`}>
                        <circle
                          r={4 / zoom}
                          fill="#fbbf24"
                          stroke="#020617"
                          strokeWidth={1.2 / zoom}
                        />
                        {idx > 0 && (
                          <text
                            y={-7 / zoom}
                            textAnchor="middle"
                            fill="#fde68a"
                            stroke="#020617"
                            strokeWidth={2.5 / zoom}
                            paintOrder="stroke"
                            fontSize={8 / zoom}
                            fontWeight="bold"
                          >
                            +{segDist.toFixed(1)}m
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          </svg>
        </div>

        {/* Top-Left Google Earth Compass & Orientation Widget */}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 text-[11px] text-slate-200 shadow-xl">
          <button
            type="button"
            onClick={resetViewTopDown}
            className="w-8 h-8 rounded-full bg-slate-950 border border-cyan-500/40 flex flex-col items-center justify-center hover:border-cyan-400 transition shrink-0"
            title="Klik untuk Reset Arah Utara & Tegak Lurus Dari Atas (90°)"
          >
            <span className="text-[9px] font-black text-red-400 leading-none">U</span>
            <Compass
              className="w-3.5 h-3.5 text-cyan-400"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </button>
          <div className="leading-tight">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>
                {cameraPitch === 'TOP_DOWN'
                  ? 'Tampilan Dari Atas (90° Top-Down)'
                  : 'Perspektif 3D Miring (45°)'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">
                Zoom {zoom.toFixed(1)}x (Lv.{tileLayers.activeZ || 16})
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Scroll: Zoom Kursor • Drag: Geser Peta</span>
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 45) % 360)}
                className="text-cyan-400 hover:underline font-semibold"
              >
                ↺ Putar
              </button>
            </div>
          </div>
        </div>

        {/* Bottom-left Legend */}
        <div className="absolute bottom-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 shadow-xl space-y-1.5 max-w-sm">
          <div className="font-bold text-white text-xs mb-1 flex items-center justify-between">
            <span>Legenda Elemen Jaringan KMZ</span>
            <span className="text-[10px] font-normal text-cyan-400">Skala 1:1 Presisi</span>
          </div>
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

        {/* Bottom-right Google Earth Live GPS Coordinates & Scale Bar */}
        <div className="absolute bottom-3 right-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2 text-[11px] text-slate-300 shadow-xl flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">
              {cursorGps
                ? `${cursorGps.lat.toFixed(6)}, ${cursorGps.lon.toFixed(6)}`
                : `${geoData.centerLat.toFixed(6)}, ${geoData.centerLon.toFixed(6)}`}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-200">{scaleBarInfo.label}</span>
            <div
              className="h-1.5 border-x-2 border-b-2 border-cyan-400 bg-cyan-400/20 mt-0.5"
              style={{ width: `${scaleBarInfo.pxWidth}px` }}
            />
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
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => openInGoogleEarthWeb(selectedItem.lat, selectedItem.lon, 180)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition"
              >
                <Globe className="w-3 h-3" />
                <span>Google Earth</span>
              </button>
              <button
                type="button"
                onClick={() => openInGoogleMapsSatellite(selectedItem.lat, selectedItem.lon)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Google Maps</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
