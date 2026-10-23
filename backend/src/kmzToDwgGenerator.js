const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { DxfWriter, point3d, point2d, Colors } = require('@tarikjabiri/dxf');
const proj4 = require('proj4');

// Default AutoCAD 2021 Console path on Windows
const ACAD_CONSOLE_PATH = path.join('C:', 'Program Files', 'Autodesk', 'AutoCAD 2021', 'accoreconsole.exe');

/**
 * Determine the optimal UTM projection definition for a given longitude and latitude
 * @param {number} lon
 * @param {number} lat
 * @returns {{ utmZone: number, isSouth: boolean, utmProj: string }}
 */
function getUtmProjection(lon, lat) {
  const utmZone = Math.floor((Number(lon) + 180) / 6) + 1;
  const isSouth = Number(lat) < 0;
  const utmProj = `+proj=utm +zone=${utmZone} ${isSouth ? '+south' : ''} +datum=WGS84 +units=m +no_defs`;
  return { utmZone, isSouth, utmProj };
}

/**
 * Convert DXF file to DWG using AutoCAD Core Console (accoreconsole.exe)
 * @param {string} dxfFilePath
 * @param {string} dwgFilePath
 * @returns {Promise<boolean>}
 */
async function convertDxfToDwgWithAutoCad(dxfFilePath, dwgFilePath) {
  if (!fs.existsSync(ACAD_CONSOLE_PATH)) {
    return false;
  }

  const scrPath = path.join(path.dirname(dxfFilePath), `conv_${Date.now()}_${Math.floor(Math.random() * 10000)}.scr`);
  const normalizedDxf = path.resolve(dxfFilePath);
  const normalizedDwg = path.resolve(dwgFilePath);

  // AutoCAD script: Open DXF, SaveAs DWG 2018, Quit
  const scrContent = [
    'DXFIN',
    normalizedDxf,
    'SAVEAS',
    '2018',
    normalizedDwg,
    'QUIT',
    '',
  ].join('\r\n');

  fs.writeFileSync(scrPath, scrContent, 'utf8');

  return new Promise((resolve) => {
    execFile(
      ACAD_CONSOLE_PATH,
      ['/s', scrPath, '/l', 'en-US'],
      { timeout: 20000, windowsHide: true },
      (error) => {
        try {
          if (fs.existsSync(scrPath)) fs.unlinkSync(scrPath);
        } catch (_) {}

        if (fs.existsSync(normalizedDwg) && fs.statSync(normalizedDwg).size > 0) {
          resolve(true);
        } else {
          console.warn('accoreconsole execution warning:', error?.message);
          resolve(false);
        }
      }
    );
  });
}

/**
 * Generate full AutoCAD drawing (DXF and DWG) from a parsed Project object
 * @param {Object} project
 * @param {Object} options
 * @returns {Promise<{ dxfString: string, dxfBuffer: Buffer, dwgBuffer: Buffer | null, stats: Object }>}
 */
async function generateCadFromProject(project, options = {}) {
  const dxf = new DxfWriter();

  // 1. Establish Coordinate Projection
  const fdtList = project.fdts || [];
  const firstFdt = fdtList[0] || {};
  const anchorLon = Number(firstFdt.longitude || project.poles?.[0]?.longitude || 124.324);
  const anchorLat = Number(firstFdt.latitude || project.poles?.[0]?.latitude || 0.713);

  const { utmZone, isSouth, utmProj } = getUtmProjection(anchorLon, anchorLat);

  function toCad(lon, lat) {
    if (lon === null || lon === undefined || lat === null || lat === undefined) return { x: 0, y: 0 };
    const [x, y] = proj4('WGS84', utmProj, [Number(lon), Number(lat)]);
    return { x, y };
  }

  // 2. Setup Standard FTTH AutoCAD Layers & Colors matching CONTOH DWG.dwg
  dxf.addLayer('0', Colors.White);
  dxf.addLayer('BATAS', 2); // Color 2 = Yellow
  dxf.addLayer('BOUNDARY', 2); // Color 2 = Yellow
  dxf.addLayer('FAT AREA', 134); // Color 134 = Spring Green
  dxf.addLayer('Home Number', 6); // Color 6 = Magenta
  dxf.addLayer('FAT', 4); // Color 4 = Cyan
  dxf.addLayer('FAT CODE', 7); // Color 7 = White
  dxf.addLayer('FDT', 1); // Color 1 = Red
  dxf.addLayer('FDT ID', 1); // Color 1 = Red
  dxf.addLayer('NEW POLE 7M 2.5INCH', 200); // Color 200 = Standard Drafter Slate
  dxf.addLayer('NEW POLE 7m(3 inches)', 4); // Color 4 = Cyan
  dxf.addLayer('NEW POLE 7m(4 inches)', 3); // Color 3 = Green
  dxf.addLayer('NEW POLE 9m', 170); // Color 170 = Blue
  dxf.addLayer('EXT POLE', 16); // Color 16 = Orange / Brown
  dxf.addLayer('FO 24 CORE', 3); // Color 3 = Green
  dxf.addLayer('FO 36 CORE', 6); // Color 6 = Magenta
  dxf.addLayer('FO 48 CORE', 1); // Color 1 = Red
  dxf.addLayer('FO 72 CORE', 34); // Color 34 = Brown
  dxf.addLayer('SLING WIRE', 4); // Color 4 = Cyan
  dxf.addLayer('LABEL CABLE', 2); // Color 2 = Yellow
  dxf.addLayer('SPAN KU', 161); // Color 161 = Cyan
  dxf.addLayer('DESIGN SUMMARY', 7); // Color 7 = White
  dxf.addLayer('TITLE BLOCK', 7); // Color 7 = White

  // Track bounding box of drawing for placement of Design Summary & Title Block
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  function trackBounds(x, y) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // 3. Draw Cluster Boundary (BATAS)
  if (project.boundaryCoordsJson) {
    try {
      const parsed = typeof project.boundaryCoordsJson === 'string'
        ? JSON.parse(project.boundaryCoordsJson)
        : project.boundaryCoordsJson;
      const polyGroups = Array.isArray(parsed) && Array.isArray(parsed[0]) && typeof parsed[0][0] === 'object'
        ? parsed
        : [parsed];

      for (const bCoords of polyGroups) {
        if (Array.isArray(bCoords) && bCoords.length >= 3) {
          const polyVerts = bCoords.map((c) => {
            const p = toCad(c.longitude || c.lon || c[0], c.latitude || c.lat || c[1]);
            trackBounds(p.x, p.y);
            return { point: point2d(p.x, p.y) };
          });
          dxf.addLWPolyline(polyVerts, { layerName: 'BATAS', flags: 1 });
        }
      }
    } catch (_) {}
  }

  // 4. Draw FDTs (matching CONTOH DWG.dwg)
  for (const fdt of fdtList) {
    if (fdt.longitude && fdt.latitude) {
      const pt = toCad(fdt.longitude, fdt.latitude);
      trackBounds(pt.x, pt.y);

      // FDT Symbol: Red double circle with radial crosshairs & square
      dxf.addCircle(point3d(pt.x, pt.y, 0), 4.5, { layerName: 'FDT' });
      dxf.addCircle(point3d(pt.x, pt.y, 0), 2.5, { layerName: 'FDT' });
      dxf.addLine(point3d(pt.x - 4.5, pt.y, 0), point3d(pt.x + 4.5, pt.y, 0), { layerName: 'FDT' });
      dxf.addLine(point3d(pt.x, pt.y - 4.5, 0), point3d(pt.x, pt.y + 4.5, 0), { layerName: 'FDT' });
      dxf.addLine(point3d(pt.x - 3.2, pt.y - 3.2, 0), point3d(pt.x + 3.2, pt.y + 3.2, 0), { layerName: 'FDT' });
      dxf.addLine(point3d(pt.x - 3.2, pt.y + 3.2, 0), point3d(pt.x + 3.2, pt.y - 3.2, 0), { layerName: 'FDT' });
      dxf.addRectangle(point2d(pt.x - 3.2, pt.y - 3.2), point2d(pt.x + 3.2, pt.y + 3.2), { layerName: 'FDT' });

      // Red FDT Labels matching "XXX.XX | Total HP 134" in CONTOH DWG
      const fdtName = fdt.fdtId || project.clusterCode || 'FDT';
      const totalHpText = `| Total HP ${fdt.totalHp || project.totalHomepass || 0}`;
      dxf.addText(point3d(pt.x + 6.0, pt.y + 1.8, 0), 3.2, fdtName, { layerName: 'FDT ID' });
      dxf.addText(point3d(pt.x + 6.0, pt.y - 2.0, 0), 2.8, totalHpText, { layerName: 'FDT ID' });
    }
  }

  // 5. Draw FATs, FAT Area Coverage & Homepasses
  for (const fdt of fdtList) {
    const fats = fdt.fats || [];
    for (const fat of fats) {
      if (fat.longitude && fat.latitude) {
        const fpt = toCad(fat.longitude, fat.latitude);
        trackBounds(fpt.x, fpt.y);

        // FAT Block: Exact match to media_1792685160012_a6a6e216.png
        // 1. Outer Orange Box (Color 30, Width 7.5, Height 4.5)
        dxf.addLWPolyline([
          { point: point2d(fpt.x - 4.5, fpt.y + 2.25) },
          { point: point2d(fpt.x + 3.0, fpt.y + 2.25) },
          { point: point2d(fpt.x + 3.0, fpt.y - 2.25) },
          { point: point2d(fpt.x - 4.5, fpt.y - 2.25) },
        ], { layerName: 'FAT', colorNumber: 30, flags: 1 });

        // 2. Inner Orange Box (Color 30, Margin 0.25)
        dxf.addLWPolyline([
          { point: point2d(fpt.x - 4.25, fpt.y + 2.0) },
          { point: point2d(fpt.x + 2.75, fpt.y + 2.0) },
          { point: point2d(fpt.x + 2.75, fpt.y - 2.0) },
          { point: point2d(fpt.x - 4.25, fpt.y - 2.0) },
        ], { layerName: 'FAT', colorNumber: 30, flags: 1 });

        // 3. Solid Yellow Triangle (Color 2, pointing right ▶)
        for (let s = 0; s <= 12; s++) {
          const t = s / 12;
          const tx = -4.25 + t * (-2.4 - (-4.25));
          const halfH = 2.0 * (1 - t);
          dxf.addLine(
            point3d(fpt.x + tx, fpt.y - halfH, 0),
            point3d(fpt.x + tx, fpt.y + halfH, 0),
            { layerName: 'FAT', colorNumber: 2 }
          );
        }
        dxf.addLWPolyline([
          { point: point2d(fpt.x - 4.25, fpt.y + 2.0) },
          { point: point2d(fpt.x - 4.25, fpt.y - 2.0) },
          { point: point2d(fpt.x - 2.4, fpt.y + 0.0) },
        ], { layerName: 'FAT', colorNumber: 2, flags: 1 });

        // 4. Bold White Number "16" inside the box (Color 7, Height 2.8)
        const fatCapText = String(fat.capacity || fat.hpCount || 16);
        dxf.addText(point3d(fpt.x - 0.7, fpt.y - 1.2, 0), 2.8, fatCapText, {
          layerName: 'FAT CODE',
          colorNumber: 7,
        });

        // 5. Orange FAT Code Text below the box (e.g. "A12", Color 30, Height 3.0)
        const fatLabel = fat.fatCode || `FAT-${fat.fatIndex || ''}`;
        dxf.addText(point3d(fpt.x - 2.2, fpt.y - 5.8, 0), 3.0, fatLabel, {
          layerName: 'FAT',
          colorNumber: 30,
        });
      }

      // Draw FAT Coverage Area Polygon (FAT AREA - Color 134 Spring Green)
      if (fat.boundaryJson) {
        try {
          const areaCoords = typeof fat.boundaryJson === 'string'
            ? JSON.parse(fat.boundaryJson)
            : fat.boundaryJson;
          if (Array.isArray(areaCoords) && areaCoords.length >= 3) {
            const areaVerts = areaCoords.map((c) => {
              const p = toCad(c.longitude || c.lon || c[0], c.latitude || c.lat || c[1]);
              trackBounds(p.x, p.y);
              return { point: point2d(p.x, p.y) };
            });
            dxf.addLWPolyline(areaVerts, { layerName: 'FAT AREA', flags: 1 });
          }
        } catch (_) {}
      }

      // Draw Homepasses (Home Number - Magenta Text Only, matching CONTOH DWG)
      const hps = fat.homepasses || [];
      hps.forEach((hp, hpIdx) => {
        if (hp.longitude && hp.latitude) {
          const hpt = toCad(hp.longitude, hp.latitude);
          trackBounds(hpt.x, hpt.y);

          // Direct Magenta text number, Height 2.8 matching CONTOH DWG
          const numStr = String(hp.homeNumber || (hpIdx + 1));
          dxf.addText(point3d(hpt.x - 1.0, hpt.y - 1.0, 0), 2.8, numStr, { layerName: 'Home Number' });
        }
      });
    }

    // Draw Cable Routes (DISTRIBUTION CABLE & SLING WIRE)
    const routes = fdt.cableRoutes || [];
    for (const cr of routes) {
      if (cr.coords && cr.coords.length > 1) {
        const polyVerts = cr.coords.map((c) => {
          const pt = toCad(c.longitude || c.lon || c[0], c.latitude || c.lat || c[1]);
          trackBounds(pt.x, pt.y);
          return { point: point2d(pt.x, pt.y) };
        });

        let layerName = 'FO 24 CORE';
        const cap = String(cr.capacity || cr.name || '').toUpperCase();
        if (cap.includes('SLING')) {
          layerName = 'SLING WIRE';
        } else if (cap.includes('72')) {
          layerName = 'FO 72 CORE';
        } else if (cap.includes('48')) {
          layerName = 'FO 48 CORE';
        } else if (cap.includes('36')) {
          layerName = 'FO 36 CORE';
        }

        dxf.addLWPolyline(polyVerts, { layerName });

        // Yellow cable route label text along cable path
        const midIdx = Math.floor(polyVerts.length / 2);
        const midPt = polyVerts[midIdx]?.point;
        if (midPt) {
          const cableLabel = cr.name || `CABLE LINE 4 FO 24C/2D - AC = ${Math.round(cr.lengthM || 427)} M`;
          dxf.addText(point3d(midPt.x + 1.5, midPt.y + 1.5, 0), 2.0, cableLabel, { layerName: 'LABEL CABLE' });
        }

        // Span distance between consecutive points (SPAN KU, e.g. "27m")
        for (let i = 1; i < polyVerts.length; i++) {
          const p1 = polyVerts[i - 1].point;
          const p2 = polyVerts[i].point;
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (dist >= 10) {
            const spanX = (p1.x + p2.x) / 2;
            const spanY = (p1.y + p2.y) / 2;
            dxf.addText(point3d(spanX + 0.8, spanY + 0.8, 0), 1.8, `${Math.round(dist)}m`, {
              layerName: 'SPAN KU',
              colorNumber: 161,
            });
          }
        }
      }
    }
  }

  // 6. Draw Poles (TIANG - Exact Pole Block matching media_1792685160012_a6a6e216.png)
  const poles = project.poles || [];
  for (const pole of poles) {
    if (pole.longitude && pole.latitude) {
      const ppt = toCad(pole.longitude, pole.latitude);
      trackBounds(ppt.x, ppt.y);

      const cat = String(pole.poleCategory || '').toUpperCase();
      let layerName = 'NEW POLE 7m(3 inches)';
      let poleTop = 'NP7';
      let poleBottom = "3'";

      if (cat.includes('9M') || cat.includes('9-')) {
        layerName = 'NEW POLE 9m';
        poleTop = 'NP9';
        poleBottom = "4'";
      } else if (cat.includes('2.5') || cat.includes('7-2.5')) {
        layerName = 'NEW POLE 7M 2.5INCH';
        poleTop = 'NP7';
        poleBottom = "2.5'";
      } else if (cat.includes('7-4') || cat.includes('4 INCH') || cat.includes('7M 4')) {
        layerName = 'NEW POLE 7m(4 inches)';
        poleTop = 'NP7';
        poleBottom = "4'";
      } else if (cat.includes('EXISTING') || cat.includes('EXT')) {
        layerName = 'EXT POLE';
        poleTop = 'EXT';
        poleBottom = 'PLN';
      }

      // 1. Cyan Circle (Color 4, Radius 2.2)
      dxf.addCircle(point3d(ppt.x, ppt.y, 0), 2.2, { layerName, colorNumber: 4 });

      // 2. Text Inside Circle: Top (NP7/NP9), Bottom (3'/4')
      dxf.addText(point3d(ppt.x - 1.2, ppt.y + 0.3, 0), 1.3, poleTop, {
        layerName,
        colorNumber: 4,
      });
      dxf.addText(point3d(ppt.x - 0.6, ppt.y - 1.5, 0), 1.3, poleBottom, {
        layerName,
        colorNumber: 4,
      });

      // 3. Beside Circle: Large Bold Cyan Pole ID (e.g. "MR.XXX.P032", Height 3.0)
      if (pole.poleId) {
        dxf.addText(point3d(ppt.x + 3.0, ppt.y - 0.5, 0), 3.0, pole.poleId, {
          layerName,
          colorNumber: 4,
        });
      }
    }
  }

  // 7. Calculate Drawing Bounds & Dimensions
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(maxX)) maxX = 1000;
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxY)) maxY = 1000;

  const width = Math.max(200, maxX - minX);
  const height = Math.max(200, maxY - minY);

  // Position Design Summary and Title Block to the right of the map
  const tableX = maxX + 40;
  const tableY = maxY;

  // 8. Draw Design Summary Table (Tabel Rekapitulasi Desain Jaringan)
  dxf.addRectangle(point2d(tableX, tableY - 260), point2d(tableX + 180, tableY), { layerName: 'DESIGN SUMMARY' });
  dxf.addRectangle(point2d(tableX, tableY - 25), point2d(tableX + 180, tableY), { layerName: 'DESIGN SUMMARY' });
  dxf.addText(point3d(tableX + 15, tableY - 18, 0), 4.5, 'DESIGN SUMMARY (REKAPITULASI)', { layerName: 'DESIGN SUMMARY' });

  const summaryRows = [
    ['NAMA CLUSTER', project.clusterName || 'FTTH CLUSTER'],
    ['KODE CLUSTER', project.clusterCode || 'SND-01'],
    ['REGION / AREA', project.region || 'NASIONAL'],
    ['TOTAL HOMEPASS', `${project.totalHomepass || 0} HP`],
    ['TOTAL FDT', `${project.totalFdt || fdtList.length} Unit`],
    ['TOTAL FAT 16 PORT', `${project.totalFat || 0} Unit`],
    ['TOTAL TIANG (ALL)', `${project.totalPoles || poles.length} Batang`],
    ['TOTAL RUTE KABEL', `${project.totalCableRouteM || 0} Meter`],
    ['TOTAL KABEL FO', `${project.totalCableLengthM || 0} Meter`],
    ['TOTAL SLING WIRE', `${project.totalSlingWireM || 0} Meter`],
    ['SISTEM KOORDINAT', `WGS84 UTM Zone ${utmZone}${isSouth ? 'S' : 'N'}`],
    ['TANGGAL DRAFT', new Date().toISOString().slice(0, 10)],
  ];

  let currentY = tableY - 45;
  for (const [label, val] of summaryRows) {
    dxf.addLine(point3d(tableX, currentY + 12, 0), point3d(tableX + 180, currentY + 12, 0), { layerName: 'DESIGN SUMMARY' });
    dxf.addText(point3d(tableX + 8, currentY, 0), 2.2, label, { layerName: 'DESIGN SUMMARY' });
    dxf.addText(point3d(tableX + 85, currentY, 0), 2.2, ':', { layerName: 'DESIGN SUMMARY' });
    dxf.addText(point3d(tableX + 95, currentY, 0), 2.2, String(val), { layerName: 'DESIGN SUMMARY' });
    currentY -= 17;
  }

  // 9. Draw Title Block (KOP Gambar AutoCAD Standar)
  const tbX = tableX;
  const tbY = currentY - 25;
  dxf.addRectangle(point2d(tbX, tbY - 140), point2d(tbX + 180, tbY), { layerName: 'TITLE BLOCK' });
  dxf.addRectangle(point2d(tbX, tbY - 25), point2d(tbX + 180, tbY), { layerName: 'TITLE BLOCK' });
  dxf.addText(point3d(tbX + 25, tbY - 18, 0), 4.2, 'AS-PLAN DRAWING FTTH', { layerName: 'TITLE BLOCK' });

  const titleRows = [
    ['Proyek', project.clusterName || 'FTTH NETWORK'],
    ['Drawing Type', 'APD Distribusi FTTH Network'],
    ['Drafter', 'TOSKA FTTH SND GeoStudio'],
    ['Reference GPS', `${anchorLat.toFixed(6)}°  ${anchorLon.toFixed(6)}°`],
    ['Skala', '1 : 1000 (Meters)'],
    ['Status', 'AS PLAN COMPLETED'],
  ];

  let titleY = tbY - 45;
  for (const [k, v] of titleRows) {
    dxf.addText(point3d(tbX + 8, titleY, 0), 2.2, k, { layerName: 'TITLE BLOCK' });
    dxf.addText(point3d(tbX + 65, titleY, 0), 2.2, ':', { layerName: 'TITLE BLOCK' });
    dxf.addText(point3d(tbX + 75, titleY, 0), 2.2, String(v), { layerName: 'TITLE BLOCK' });
    titleY -= 17;
  }

  // North Arrow Symbol
  const naX = tbX + 155;
  const naY = tbY - 95;
  dxf.addCircle(point3d(naX, naY, 0), 10, { layerName: 'TITLE BLOCK' });
  dxf.addLine(point3d(naX, naY - 10, 0), point3d(naX, naY + 10, 0), { layerName: 'TITLE BLOCK' });
  dxf.addLine(point3d(naX - 10, naY, 0), point3d(naX + 10, naY, 0), { layerName: 'TITLE BLOCK' });
  dxf.addLine(point3d(naX, naY + 10, 0), point3d(naX - 3, naY + 4, 0), { layerName: 'TITLE BLOCK' });
  dxf.addLine(point3d(naX, naY + 10, 0), point3d(naX + 3, naY + 4, 0), { layerName: 'TITLE BLOCK' });
  dxf.addText(point3d(naX - 1.5, naY + 12, 0), 3.0, 'U', { layerName: 'TITLE BLOCK' });

  // 10. Stringify DXF Output
  const dxfString = dxf.stringify();
  const dxfBuffer = Buffer.from(dxfString, 'utf8');

  // 11. Convert to Native AutoCAD DWG using accoreconsole if available
  let dwgBuffer = null;
  const tempDxfPath = path.join(__dirname, `../uploads/temp_${Date.now()}_${Math.floor(Math.random() * 1000)}.dxf`);
  const tempDwgPath = tempDxfPath.replace(/\.dxf$/, '.dwg');

  try {
    fs.writeFileSync(tempDxfPath, dxfBuffer);
    const success = await convertDxfToDwgWithAutoCad(tempDxfPath, tempDwgPath);
    if (success && fs.existsSync(tempDwgPath)) {
      dwgBuffer = fs.readFileSync(tempDwgPath);
    }
  } catch (convErr) {
    console.warn('DWG generation note (DXF remains fully functional):', convErr.message);
  } finally {
    try {
      if (fs.existsSync(tempDxfPath)) fs.unlinkSync(tempDxfPath);
      if (fs.existsSync(tempDwgPath)) fs.unlinkSync(tempDwgPath);
    } catch (_) {}
  }

  const stats = {
    clusterName: project.clusterName,
    clusterCode: project.clusterCode,
    utmZone,
    isSouth,
    utmProjection: `UTM Zone ${utmZone}${isSouth ? 'S' : 'N'}`,
    totalFdt: fdtList.length,
    totalFat: project.totalFat || 0,
    totalHomepass: project.totalHomepass || 0,
    totalPoles: poles.length,
    totalCableRouteM: project.totalCableRouteM || 0,
    hasNativeDwg: Boolean(dwgBuffer),
    dxfSizeBytes: dxfBuffer.length,
    dwgSizeBytes: dwgBuffer ? dwgBuffer.length : null,
  };

  return {
    dxfString,
    dxfBuffer,
    dwgBuffer,
    stats,
  };
}

module.exports = {
  generateCadFromProject,
  convertDxfToDwgWithAutoCad,
  getUtmProjection,
};
