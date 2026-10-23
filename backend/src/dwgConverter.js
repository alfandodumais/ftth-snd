const path = require('path');
const JSZip = require('jszip');
const proj4 = require('proj4');

// Lazy singleton for LibreDWG wasm
let libreDwgInstance = null;
async function getLibreDwg() {
  if (!libreDwgInstance) {
    const { LibreDwg } = await import('@mlightcad/libredwg-web');
    const wasmDir = path.resolve(__dirname, '../node_modules/@mlightcad/libredwg-web/wasm');
    libreDwgInstance = await LibreDwg.create(wasmDir);
  }
  return libreDwgInstance;
}

// Point in polygon test
function pointInPoly(x, y, verts) {
  if (!verts || verts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x;
    const yi = verts[i].y;
    const xj = verts[j].x;
    const yj = verts[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToPoly(x, y, verts) {
  let minD = Infinity;
  for (const v of verts) {
    const d = Math.hypot(x - v.x, y - v.y);
    if (d < minD) minD = d;
  }
  return minD;
}

function polyLength(verts) {
  let len = 0;
  for (let i = 1; i < verts.length; i++) {
    len += Math.hypot(verts[i].x - verts[i - 1].x, verts[i].y - verts[i - 1].y);
  }
  return len;
}

/**
 * Convert AutoCAD DWG buffer to KMZ buffer
 * @param {Buffer} dwgBuffer
 * @param {Object} options
 * @returns {Promise<{ kmzBuffer: Buffer, kmlText: string, metadata: Object, stats: Object }>}
 */
async function convertDwgToKmz(dwgBuffer, options = {}) {
  const libredwg = await getLibreDwg();
  const { Dwg_File_Type } = await import('@mlightcad/libredwg-web');

  const ab = dwgBuffer.buffer.slice(dwgBuffer.byteOffset, dwgBuffer.byteOffset + dwgBuffer.byteLength);
  const dwgData = libredwg.dwg_read_data(ab, Dwg_File_Type.DWG);
  const db = libredwg.convert(dwgData);
  libredwg.dwg_free(dwgData);

  const entities = db.entities || [];
  const modelEntities = entities.filter((e) => e.ownerBlockRecordSoftId === '1F');

  function getEntityPoint(e) {
    if (e.insertionPoint && (e.insertionPoint.x !== 0 || e.insertionPoint.y !== 0)) return e.insertionPoint;
    if (e.startPoint && (e.startPoint.x !== 0 || e.startPoint.y !== 0)) return e.startPoint;
    if (e.center) return e.center;
    if (e.vertices?.length) return e.vertices[0];
    return null;
  }

  // 1. Scan Metadata & Title Block info across all entities
  let clusterName = options.clusterName || '';
  let clusterCode = options.clusterCode || '';
  let clusterAddress = options.address || '';
  let autoLat = null;
  let autoLon = null;

  for (const e of entities) {
    const textVal = String(e.text || '').trim();
    if (!textVal) continue;

    if (autoLat === null && /(\d+\.\d+)[°\s,]+(\d+\.\d+)/.test(textVal)) {
      const m = textVal.match(/(\d+\.\d+)[°\s,]+(\d+\.\d+)/);
      if (m) {
        const val1 = parseFloat(m[1]);
        const val2 = parseFloat(m[2]);
        if (val1 < 12 && val2 > 90) {
          autoLat = val1;
          autoLon = val2;
        } else if (val2 < 12 && val1 > 90) {
          autoLat = val2;
          autoLon = val1;
        }
      }
    }

    if (!clusterName && /KELURAHAN|KECAMATAN|DESA|AMPRENG|LANGOWAN|KOTAMOBAGU/i.test(textVal) && textVal.length > 8 && textVal.length < 60) {
      clusterName = textVal;
    }
    if (!clusterAddress && /Jl\.|Jalan|Desa|Kec\.|Kabupaten|Kota/i.test(textVal) && textVal.length > 20) {
      clusterAddress = textVal;
    }
  }

  if (!clusterName) clusterName = 'AMPRENG LANGOWAN BARAT MANADO';
  if (!clusterCode) {
    const words = clusterName.split(/\s+/).filter((w) => w.length > 2);
    clusterCode = words.map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'CLST';
  }

  const anchorLat = options.anchorLat !== undefined && options.anchorLat !== null ? Number(options.anchorLat) : (autoLat ?? 1.148823);
  const anchorLon = options.anchorLon !== undefined && options.anchorLon !== null ? Number(options.anchorLon) : (autoLon ?? 124.810535);

  // 2. Identify FDT in Model Space
  const fdtInserts = modelEntities.filter(
    (e) => (e.layer === 'FDT' || e.layer === 'FDT-Info') && e.type === 'INSERT' && (e.insertionPoint?.x !== 0 || e.insertionPoint?.y !== 0)
  );

  let fdtX = 3480.501756;
  let fdtY = 770.783591;
  let fdtCode = 'FDT-01';

  if (fdtInserts.length > 0) {
    fdtX = fdtInserts[0].insertionPoint.x;
    fdtY = fdtInserts[0].insertionPoint.y;
  }

  const fdtIdText = modelEntities.find(
    (e) => e.layer === 'FDT ID' || (e.layer === 'FDT' && e.type === 'TEXT')
  );
  if (fdtIdText?.text) {
    fdtCode = fdtIdText.text.trim();
  }

  const isDirectWgs84 = fdtX >= 90 && fdtX <= 145 && Math.abs(fdtY) <= 15;
  const isUtm = fdtX >= 100000 && fdtX <= 900000;

  function toWgs84(x, y) {
    if (isDirectWgs84) return { lat: y, lon: x };
    if (isUtm) {
      const utmZone = options.utmZone || 51;
      const isSouth = options.utmSouth ?? anchorLat < 0;
      const utmProj = `+proj=utm +zone=${utmZone} ${isSouth ? '+south' : ''} +datum=WGS84 +units=m +no_defs`;
      const [lon, lat] = proj4(utmProj, 'WGS84', [x, y]);
      return { lat, lon };
    }
    const dx = x - fdtX;
    const dy = y - fdtY;
    const lat = anchorLat + dy / 110574;
    const lon = anchorLon + dx / (111320 * Math.cos((anchorLat * Math.PI) / 180));
    return { lat, lon };
  }

  // 3. Extract Main Map Network Elements
  const mapEntities = modelEntities.filter((e) => {
    const pt = getEntityPoint(e);
    if (!pt) return false;
    return Math.hypot(pt.x - fdtX, pt.y - fdtY) < 3000;
  });

  // A. FAT entities
  const fatInsertsMap = mapEntities.filter((e) => e.layer === 'FAT' && e.type === 'INSERT');
  const fatTextsMap = mapEntities.filter((e) => e.layer === 'FAT' && e.type === 'TEXT');

  const fats = [];
  for (const t of fatTextsMap) {
    const tx = t.startPoint.x;
    const ty = t.startPoint.y;
    let bestIns = null;
    let bestD = Infinity;
    for (const ins of fatInsertsMap) {
      const d = Math.hypot(tx - ins.insertionPoint.x, ty - ins.insertionPoint.y);
      if (d < bestD) {
        bestD = d;
        bestIns = ins;
      }
    }
    const fx = bestIns ? bestIns.insertionPoint.x : tx;
    const fy = bestIns ? bestIns.insertionPoint.y : ty;
    const gps = toWgs84(fx, fy);
    const code = t.text.trim();
    const lineLetter = code[0] && /[A-Z]/i.test(code[0]) ? code[0].toUpperCase() : 'A';
    fats.push({
      code,
      lineLetter,
      cadX: fx,
      cadY: fy,
      textX: tx,
      textY: ty,
      lat: gps.lat,
      lon: gps.lon,
    });
  }

  fats.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  // B. FAT AREA Boundaries
  const fatAreaPolys = mapEntities.filter((e) => e.layer === 'FAT AREA' && e.type === 'LWPOLYLINE' && e.vertices?.length >= 3);
  const matchedAreas = [];

  for (const poly of fatAreaPolys) {
    const verts = poly.vertices;
    let matchedFat = fats.find((f) => pointInPoly(f.cadX, f.cadY, verts) || pointInPoly(f.textX, f.textY, verts));
    if (!matchedFat) {
      let minD = Infinity;
      for (const f of fats) {
        const d = distToPoly(f.cadX, f.cadY, verts);
        if (d < minD) {
          minD = d;
          matchedFat = f;
        }
      }
    }
    if (matchedFat) {
      const coordsGps = verts.map((v) => {
        const g = toWgs84(v.x, v.y);
        return `${g.lon.toFixed(10)},${g.lat.toFixed(10)},0`;
      });
      if (coordsGps[0] !== coordsGps[coordsGps.length - 1]) {
        coordsGps.push(coordsGps[0]);
      }
      matchedAreas.push({
        fatCode: matchedFat.code,
        lineLetter: matchedFat.lineLetter,
        verts,
        coordsString: coordsGps.join(' '),
      });
    }
  }

  // C. Home Numbers
  const hnTexts = mapEntities.filter((e) => e.layer === 'Home Number' && e.type === 'TEXT');
  const homepasses = [];

  for (const hn of hnTexts) {
    const hx = (hn.startPoint.x + (hn.endPoint?.x || hn.startPoint.x)) / 2;
    const hy = (hn.startPoint.y + (hn.endPoint?.y || hn.startPoint.y)) / 2;
    const num = hn.text.trim();

    let matchedFatCode = null;
    let matchedLine = 'A';
    for (const ma of matchedAreas) {
      if (pointInPoly(hx, hy, ma.verts) || pointInPoly(hn.startPoint.x, hn.startPoint.y, ma.verts)) {
        matchedFatCode = ma.fatCode;
        matchedLine = ma.lineLetter;
        break;
      }
    }
    if (!matchedFatCode) {
      let minD = Infinity;
      for (const ma of matchedAreas) {
        const d = distToPoly(hx, hy, ma.verts);
        if (d < minD) {
          minD = d;
          matchedFatCode = ma.fatCode;
          matchedLine = ma.lineLetter;
        }
      }
    }

    const gps = toWgs84(hx, hy);
    homepasses.push({
      homeNumber: num,
      fatCode: matchedFatCode || (fats[0]?.code || 'A01'),
      lineLetter: matchedLine,
      cadX: hx,
      cadY: hy,
      lat: gps.lat,
      lon: gps.lon,
    });
  }

  // D. Poles
  const poleLayers = [
    { layer: 'NEW POLE 7M 2.5INCH', folder: 'NEW POLE 7-2.5', style: '#m_autocad_1c83' },
    { layer: 'NEW POLE 7m(3 inches)', folder: 'NEW POLE 7-3', style: '#m_autocad_104' },
    { layer: 'NEW POLE 7m(4 inches)', folder: 'NEW POLE 7-4', style: '#msn_placemark_circle2' },
    { layer: "NEW POLE 7'3", folder: 'NEW POLE 7-3', style: '#m_autocad_104' },
    { layer: "NEW POLE 7'4", folder: 'NEW POLE 7-4', style: '#msn_placemark_circle2' },
    { layer: 'PROPOSES NEW POLE 9m', folder: 'NEW POLE 9-4', style: '#m_autocad_104' },
    { layer: 'EXT POLE', folder: 'EXISTING POLE EMR 7-3', style: '#m_autocad_1108' },
  ];

  const poleTexts = mapEntities.filter((e) => /^MR\./i.test(String(e.text || '').trim()));
  const poles = [];

  for (const pl of poleLayers) {
    const pInserts = mapEntities.filter((e) => e.layer === pl.layer && e.type === 'INSERT');
    for (const ins of pInserts) {
      const px = ins.insertionPoint.x;
      const py = ins.insertionPoint.y;

      let bestName = `POLE-${poles.length + 1}`;
      let minD = Infinity;
      for (const pt of poleTexts) {
        const d = Math.hypot(px - pt.startPoint.x, py - pt.startPoint.y);
        if (d < minD && d < 40) {
          minD = d;
          bestName = pt.text.trim();
        }
      }

      let closestLine = 'A';
      let closestFatDist = Infinity;
      for (const f of fats) {
        const d = Math.hypot(px - f.cadX, py - f.cadY);
        if (d < closestFatDist) {
          closestFatDist = d;
          closestLine = f.lineLetter;
        }
      }

      const gps = toWgs84(px, py);
      poles.push({
        name: bestName,
        folder: pl.folder,
        style: pl.style,
        lineLetter: closestLine,
        cadX: px,
        cadY: py,
        lat: gps.lat,
        lon: gps.lon,
      });
    }
  }

  // E. Distribution Cables
  const cableLayers = ['FO 36 CORE', 'FO 24 CORE', 'FO 48 CORE', 'FO 72 CORE'];
  const cables = [];

  for (const cl of cableLayers) {
    const lines = mapEntities.filter((e) => e.layer === cl && (e.type === 'LWPOLYLINE' || e.type === 'LINE'));
    for (const line of lines) {
      let verts = [];
      if (line.type === 'LWPOLYLINE') verts = line.vertices || [];
      if (line.type === 'LINE') verts = [line.startPoint, line.endPoint];
      if (verts.length < 2) continue;

      const lenMeters = polyLength(verts);
      const mid = verts[Math.floor(verts.length / 2)];
      let closestLine = 'A';
      let minD = Infinity;
      for (const f of fats) {
        const d = Math.hypot(mid.x - f.cadX, mid.y - f.cadY);
        if (d < minD) {
          minD = d;
          closestLine = f.lineLetter;
        }
      }

      const coordsGps = verts.map((v) => {
        const g = toWgs84(v.x, v.y);
        return `${g.lon.toFixed(10)},${g.lat.toFixed(10)},0`;
      });

      // Map layer name to capacity (e.g. 'FO 36 CORE' -> 'FO 36C/3T')
      let capacityCode = '24C/2T';
      if (cl.includes('36')) capacityCode = '36C/3T';
      if (cl.includes('48')) capacityCode = '48C/4T';
      if (cl.includes('72')) capacityCode = '72C/6T';

      cables.push({
        layer: cl,
        capacityCode,
        lineLetter: closestLine,
        length: Math.round(lenMeters),
        coordsString: coordsGps.join(' '),
      });
    }
  }

  // F. Sling Wires
  const slingLines = mapEntities.filter((e) => e.layer === 'SLING WIRE' && (e.type === 'LWPOLYLINE' || e.type === 'LINE'));
  const slingWires = [];
  for (const sw of slingLines) {
    let verts = [];
    if (sw.type === 'LWPOLYLINE') verts = sw.vertices || [];
    if (sw.type === 'LINE') verts = [sw.startPoint, sw.endPoint];
    if (verts.length < 2) continue;

    const lenMeters = polyLength(verts);
    const mid = verts[Math.floor(verts.length / 2)];
    let closestLine = 'A';
    let minD = Infinity;
    for (const f of fats) {
      const d = Math.hypot(mid.x - f.cadX, mid.y - f.cadY);
      if (d < minD) {
        minD = d;
        closestLine = f.lineLetter;
      }
    }

    const coordsGps = verts.map((v) => {
      const g = toWgs84(v.x, v.y);
      return `${g.lon.toFixed(10)},${g.lat.toFixed(10)},0`;
    });

    slingWires.push({
      lineLetter: closestLine,
      length: Math.round(lenMeters),
      coordsString: coordsGps.join(' '),
    });
  }

  // G. Slack Hangers / Cable Markers
  const slackInserts = mapEntities.filter((e) => (e.layer === 'LABEL CABLE' || e.layer === 'FIBER SPARE COIL') && e.type === 'INSERT');
  const slackHangers = [];
  for (let idx = 0; idx < slackInserts.length; idx++) {
    const s = slackInserts[idx];
    const px = s.insertionPoint.x;
    const py = s.insertionPoint.y;

    let closestFat = fats[0];
    let minD = Infinity;
    for (const f of fats) {
      const d = Math.hypot(px - f.cadX, py - f.cadY);
      if (d < minD) {
        minD = d;
        closestFat = f;
      }
    }

    const gps = toWgs84(px, py);
    slackHangers.push({
      name: idx === 0 ? `SLACK.${fdtCode}` : `SLACK.${fdtCode}.${closestFat.code}`,
      lineLetter: closestFat.lineLetter,
      lat: gps.lat,
      lon: gps.lon,
    });
  }

  // H. Cluster Boundary
  const baPoly = mapEntities.find((e) => (e.layer === 'BA' || e.layer === 'BOUNDARY') && e.type === 'LWPOLYLINE' && e.vertices?.length >= 3);
  let boundaryCoordsString = '';
  if (baPoly) {
    const bGps = baPoly.vertices.map((v) => {
      const g = toWgs84(v.x, v.y);
      return `${g.lon.toFixed(10)},${g.lat.toFixed(10)},0`;
    });
    if (bGps[0] !== bGps[bGps.length - 1]) bGps.push(bGps[0]);
    boundaryCoordsString = bGps.join(' ');
  } else {
    const allPts = [...fats, ...homepasses];
    if (allPts.length > 0) {
      const minLon = Math.min(...allPts.map((p) => p.lon)) - 0.0003;
      const maxLon = Math.max(...allPts.map((p) => p.lon)) + 0.0003;
      const minLat = Math.min(...allPts.map((p) => p.lat)) - 0.0003;
      const maxLat = Math.max(...allPts.map((p) => p.lat)) + 0.0003;
      boundaryCoordsString = [
        `${minLon},${minLat},0`,
        `${maxLon},${minLat},0`,
        `${maxLon},${maxLat},0`,
        `${minLon},${maxLat},0`,
        `${minLon},${minLat},0`,
      ].join(' ');
    }
  }

  const distinctLines = Array.from(new Set(fats.map((f) => f.lineLetter))).sort();
  if (distinctLines.length === 0) distinctLines.push('A');

  const fdtGps = toWgs84(fdtX, fdtY);

  // 4. Build Authentic KML XML matching CONTOH KMZ.kmz
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">
<Document>
	<name>${clusterCode} - ${clusterName}</name>
	<open>1</open>
	<description>APD Distribusi -  ${clusterName}</description>
	<gx:balloonVisibility>1</gx:balloonVisibility>
	<atom:link rel="app" href="https://www.google.com/earth/about/versions/#earth-pro" title="Google Earth Pro 7.3.7.1155"></atom:link>
	<Style id="sn_ylw-pushpin">
		<IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href></Icon><hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/></IconStyle>
		<LineStyle><color>ff0000ff</color><width>2</width></LineStyle>
		<PolyStyle><color>40ffffff</color></PolyStyle>
	</Style>
	<Style id="sh_ylw-pushpin">
		<IconStyle><scale>1.3</scale><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href></Icon><hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/></IconStyle>
		<LineStyle><color>ff0000ff</color><width>2</width></LineStyle>
		<PolyStyle><color>40ffffff</color></PolyStyle>
	</Style>
	<StyleMap id="msn_ylw-pushpin">
		<Pair><key>normal</key><styleUrl>#sn_ylw-pushpin</styleUrl></Pair>
		<Pair><key>highlight</key><styleUrl>#sh_ylw-pushpin</styleUrl></Pair>
	</StyleMap>
	<Style id="sn_cross-hairs">
		<IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/cross-hairs.png</href></Icon><hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/></IconStyle>
		<LabelStyle><scale>0.9</scale></LabelStyle>
	</Style>
	<Style id="sh_cross-hairs">
		<IconStyle><scale>1.4</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/cross-hairs_highlight.png</href></Icon><hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/></IconStyle>
		<LabelStyle><scale>1.1</scale></LabelStyle>
	</Style>
	<StyleMap id="msn_cross-hairs">
		<Pair><key>normal</key><styleUrl>#sn_cross-hairs</styleUrl></Pair>
		<Pair><key>highlight</key><styleUrl>#sh_cross-hairs</styleUrl></Pair>
	</StyleMap>
	<Style id="s_fat">
		<IconStyle><scale>0.9</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon><color>ff00aaff</color></IconStyle>
		<LabelStyle><scale>0.8</scale></LabelStyle>
	</Style>
	<Style id="s_hp">
		<IconStyle><scale>0.7</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/homegardenbusiness.png</href></Icon><color>ff00ff00</color></IconStyle>
		<LabelStyle><scale>0.7</scale></LabelStyle>
	</Style>
	<Style id="s_pole">
		<IconStyle><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/target.png</href></Icon><color>ffff0000</color></IconStyle>
		<LabelStyle><scale>0.75</scale></LabelStyle>
	</Style>
	<Style id="s_cable">
		<LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
	</Style>
	<Style id="s_sling">
		<LineStyle><color>ff00ffff</color><width>2</width></LineStyle>
	</Style>
	<Style id="s_slack">
		<IconStyle><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/donut.png</href></Icon><color>ffffaa00</color></IconStyle>
		<LabelStyle><scale>0.7</scale></LabelStyle>
	</Style>
	<Style id="s_fat_poly">
		<LineStyle><color>ff0000ff</color><width>1.5</width></LineStyle>
		<PolyStyle><color>3000ffaa</color></PolyStyle>
	</Style>
`;

  kml += `	<Folder>
		<name>${clusterCode} - ${clusterName}</name>
		<open>1</open>
		<Folder>
			<name>BOUNDARY CLUSTER</name>
			<Placemark>
				<name>${clusterCode} Boundary</name>
				<description>Boundary - ${clusterName}</description>
				<styleUrl>#msn_ylw-pushpin</styleUrl>
				<Polygon>
					<tessellate>1</tessellate>
					<outerBoundaryIs>
						<LinearRing>
							<coordinates>
								${boundaryCoordsString}
							</coordinates>
						</LinearRing>
					</outerBoundaryIs>
				</Polygon>
			</Placemark>
		</Folder>
		<Folder>
			<name>FDT</name>
			<open>1</open>
			<Placemark>
				<name>${fdtCode}</name>
				<description>${clusterCode}.${fdtCode} - 72C
${fdtGps.lat.toFixed(6)}° ${fdtGps.lon.toFixed(6)}°</description>
				<LookAt>
					<longitude>${fdtGps.lon.toFixed(10)}</longitude>
					<latitude>${fdtGps.lat.toFixed(10)}</latitude>
					<altitude>0</altitude>
					<range>1000</range>
				</LookAt>
				<styleUrl>#msn_cross-hairs</styleUrl>
				<Point>
					<altitudeMode>relativeToGround</altitudeMode>
					<coordinates>${fdtGps.lon.toFixed(10)},${fdtGps.lat.toFixed(10)},0</coordinates>
				</Point>
			</Placemark>
		</Folder>
`;

  for (const lineLetter of distinctLines) {
    const lineFats = fats.filter((f) => f.lineLetter === lineLetter);
    const linePoles = poles.filter((p) => p.lineLetter === lineLetter);
    const lineCables = cables.filter((c) => c.lineLetter === lineLetter);
    const lineSlings = slingWires.filter((s) => s.lineLetter === lineLetter);
    const lineSlacks = slackHangers.filter((s) => s.lineLetter === lineLetter);

    kml += `		<Folder>
			<name>LINE ${lineLetter} FDT 1</name>
			<Folder>
				<name>BOUNDARY FAT</name>
`;
    for (const fat of lineFats) {
      const area = matchedAreas.find((a) => a.fatCode === fat.code);
      const fatHps = homepasses.filter((hp) => hp.fatCode === fat.code);
      if (area) {
        kml += `				<Placemark>
					<name>${fat.code}</name>
					<description>HP : ${fatHps.length}</description>
					<styleUrl>#s_fat_poly</styleUrl>
					<Polygon>
						<tessellate>1</tessellate>
						<outerBoundaryIs>
							<LinearRing>
								<coordinates>
									${area.coordsString}
								</coordinates>
							</LinearRing>
						</outerBoundaryIs>
					</Polygon>
				</Placemark>
`;
      }
    }
    kml += `			</Folder>
			<Folder>
				<name>FAT</name>
`;
    for (const fat of lineFats) {
      kml += `				<Placemark>
					<name>${fdtCode}.${fat.code}</name>
					<description>FAT ${fat.code} (16 Port)</description>
					<styleUrl>#s_fat</styleUrl>
					<Point>
						<altitudeMode>relativeToGround</altitudeMode>
						<coordinates>${fat.lon.toFixed(10)},${fat.lat.toFixed(10)},0</coordinates>
					</Point>
				</Placemark>
`;
    }
    kml += `			</Folder>
			<Folder>
				<name>HP COVER</name>
`;
    for (const fat of lineFats) {
      const fatHps = homepasses.filter((hp) => hp.fatCode === fat.code);
      kml += `				<Folder>
					<name>${fat.code}</name>
`;
      for (const hp of fatHps) {
        kml += `					<Placemark>
						<name>${hp.homeNumber}</name>
						<styleUrl>#s_hp</styleUrl>
						<Point>
							<altitudeMode>relativeToGround</altitudeMode>
							<coordinates>${hp.lon.toFixed(10)},${hp.lat.toFixed(10)},0</coordinates>
						</Point>
					</Placemark>
`;
      }
      kml += `				</Folder>
`;
    }
    kml += `			</Folder>
			<Folder>
				<name>HP UNCOVER</name>
			</Folder>
			<Folder>
				<name>EXISTING POLE EMR 7-3</name>
`;
    const extPoles = linePoles.filter((p) => p.folder.startsWith('EXISTING'));
    for (const p of extPoles) {
      kml += `				<Placemark>
					<name>${p.name}</name>
					<styleUrl>#s_pole</styleUrl>
					<Point>
						<altitudeMode>relativeToGround</altitudeMode>
						<coordinates>${p.lon.toFixed(10)},${p.lat.toFixed(10)},0</coordinates>
					</Point>
				</Placemark>
`;
    }
    kml += `			</Folder>
`;

    for (const pType of ['NEW POLE 7-2.5', 'NEW POLE 7-3', 'NEW POLE 7-4', 'NEW POLE 9-4']) {
      const subPoles = linePoles.filter((p) => p.folder === pType);
      kml += `			<Folder>
				<name>${pType}</name>
`;
      for (const p of subPoles) {
        kml += `				<Placemark>
					<name>${p.name}</name>
					<styleUrl>#s_pole</styleUrl>
					<Point>
						<altitudeMode>relativeToGround</altitudeMode>
						<coordinates>${p.lon.toFixed(10)},${p.lat.toFixed(10)},0</coordinates>
					</Point>
				</Placemark>
`;
      }
      kml += `			</Folder>
`;
    }

    kml += `			<Folder>
				<name>DISTRIBUTION CABLE</name>
`;
    for (let cIdx = 0; cIdx < lineCables.length; cIdx++) {
      const c = lineCables[cIdx];
      const slackUnits = lineFats.length;
      const slackMeters = slackUnits * 20;
      const totalCableLen = Math.round(c.length * 1.05 + slackMeters);

      kml += `				<Placemark>
					<name>${fdtCode} - CABLE LINE ${lineLetter} (FO ${c.capacityCode}) - AE - ${totalCableLen} M</name>
					<description>Total Route : ${c.length} m
Total Slack : ${slackUnits} unit (1 slack FDT &amp; ${slackUnits - 1} slack FAT) @20 m
Toleransi : 5%
Total Length Cable : (${c.length} + 5%) + ${slackMeters} = ${totalCableLen} m</description>
					<styleUrl>#s_cable</styleUrl>
					<LineString>
						<tessellate>1</tessellate>
						<coordinates>
							${c.coordsString}
						</coordinates>
					</LineString>
				</Placemark>
`;
    }
    kml += `			</Folder>
			<Folder>
				<name>SLACK HANGER</name>
`;
    for (const s of lineSlacks) {
      kml += `				<Placemark>
					<name>${s.name}</name>
					<styleUrl>#s_slack</styleUrl>
					<Point>
						<altitudeMode>relativeToGround</altitudeMode>
						<coordinates>${s.lon.toFixed(10)},${s.lat.toFixed(10)},0</coordinates>
					</Point>
				</Placemark>
`;
    }
    kml += `			</Folder>
			<Folder>
				<name>SLING WIRE</name>
`;
    for (let swIdx = 0; swIdx < lineSlings.length; swIdx++) {
      const sw = lineSlings[swIdx];
      kml += `				<Placemark>
					<name>SLING WIRE ${lineLetter}-${swIdx + 1} - ${sw.length} M</name>
					<styleUrl>#s_sling</styleUrl>
					<LineString>
						<tessellate>1</tessellate>
						<coordinates>
							${sw.coordsString}
						</coordinates>
					</LineString>
				</Placemark>
`;
    }
    kml += `			</Folder>
		</Folder>
`;
  }

  kml += `	</Folder>
</Document>
</kml>`;

  const zip = new JSZip();
  zip.file('doc.kml', kml);
  const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  const metadata = {
    clusterName,
    clusterCode,
    clusterAddress,
    anchorLat,
    anchorLon,
    fdtCode,
    fdtCoordinates: { lat: fdtGps.lat, lon: fdtGps.lon },
  };

  const stats = {
    totalFats: fats.length,
    totalHomepasses: homepasses.length,
    totalPoles: poles.length,
    totalCables: cables.length,
    totalLines: distinctLines.length,
    lines: distinctLines,
  };

  return {
    kmzBuffer,
    kmlText: kml,
    metadata,
    stats,
  };
}

module.exports = {
  convertDwgToKmz,
};
