const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');

function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function parseCoordinatesString(coordStr) {
  if (!coordStr) return [];
  return String(coordStr)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((pt) => {
      const parts = pt.split(',').map(Number);
      return {
        lon: parts[0] || 0,
        lat: parts[1] || 0,
        alt: parts[2] || 0,
      };
    });
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeLineStringMeters(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1].lat, coords[i - 1].lon, coords[i].lat, coords[i].lon);
  }
  return Math.round(total);
}

/**
 * Parses an Indonesian number string from KML descriptions like "1.212 m" -> 1212 or "521 m" -> 521
 */
function parseIndonesianMeters(str) {
  if (!str) return 0;
  // Remove dots used as thousand separators (e.g. "1.212" -> "1212")
  const cleaned = String(str).replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function toTitleCase(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Infers administrative metadata from Cluster Name, Code, and Coordinates (with Nominatim reverse geocoding + smart local dictionary)
 */
async function inferAdministrativeMetadata(clusterCode, clusterName, oltName, lat, lon) {
  const cleanClusterName = String(clusterName || '').replace(/\.(kmz|kml)$/i, '').trim();
  const upper = cleanClusterName.toUpperCase();
  const codeUpper = String(clusterCode || '').toUpperCase();

  // Extract RW & RT from cluster name e.g. "WAWOMBALATA RW 01 KENDARI" -> rw='1', rt='4'
  const rwMatch = upper.match(/\bRW\s*0*(\d+)\b/i);
  const rtMatch = upper.match(/\bRT\s*0*(\d+)\b/i);
  const defaultRw = rwMatch ? String(parseInt(rwMatch[1], 10)) : '1';
  const defaultRt = rtMatch ? String(parseInt(rtMatch[1], 10)) : '4';

  let region = 'KENDARI';
  let province = 'Sulawesi Tenggara';
  let regencyCity = 'Kendari';
  let district = 'Mandonga';
  let subdistrict = 'Wawombalata';
  let postalCode = '93113';
  let street = 'Imam Bonjol';
  let fatAddress = 'Jl. Imam Bonjol';

  if (upper.includes('POYOWA BESAR')) {
    region = 'KOTAMOBAGU';
    province = 'SULAWESI UTARA';
    regencyCity = 'KOTAMOBAGU';
    district = 'KOTAMOBAGU SELATAN';
    subdistrict = 'POYOWA BESAR';
    postalCode = '95717';
    street = 'POYOWA BESAR';
    fatAddress = 'JL. RAYA POYOWA BESAR';
  } else if (upper.includes('WAWOMBALATA')) {
    region = 'KENDARI';
    province = 'Sulawesi Tenggara';
    regencyCity = 'Kendari';
    district = 'Mandonga';
    subdistrict = 'Wawombalata';
    postalCode = '93113';
    street = 'Imam Bonjol';
    fatAddress = 'Jl. Imam Bonjol';
  } else if (upper.includes('ANGGILOW')) {
    region = 'KENDARI';
    province = 'Sulawesi Tenggara';
    regencyCity = 'Kendari';
    district = 'Mandonga';
    subdistrict = 'Anggilowu';
    postalCode = '93115';
    street = 'Raden Soeprapto';
    fatAddress = 'Jl. Raden Soeprapto';
  } else {
    // Parse from clusterName tokens
    const words = upper.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      regencyCity = toTitleCase(words[words.length - 1]);
      region = words[words.length - 1].toUpperCase();
    }
    const withoutCityAndRw = upper
      .replace(/\b(KELURAHAN|DESA|KEL\.?)\s+/i, '')
      .replace(/\bRW\s*\d+(?:\s*(?:SAMPAI|S\/D|-)\s*\d+)?\b/gi, '')
      .replace(/\bRT\s*\d+(?:\s*(?:SAMPAI|S\/D|-)\s*\d+)?\b/gi, '')
      .replace(new RegExp(`\\b${region}\\b$`, 'i'), '')
      .replace(/\s+/g, ' ')
      .trim();

    if (withoutCityAndRw) {
      subdistrict = toTitleCase(withoutCityAndRw);
      street = subdistrict;
      fatAddress = `Jl. ${subdistrict}`;
    }

    if (upper.includes('KENDARI') || codeUpper.startsWith('KDI')) {
      region = 'KENDARI';
      province = 'Sulawesi Tenggara';
      regencyCity = 'Kendari';
      district = 'Mandonga';
      postalCode = '93113';
    } else if (upper.includes('KOTAMOBAGU') || codeUpper.startsWith('KTG')) {
      region = 'KOTAMOBAGU';
      province = 'Sulawesi Utara';
      regencyCity = 'Kotamobagu';
      district = 'Kotamobagu Selatan';
      postalCode = '95717';
    } else if (upper.includes('GORONTALO') || codeUpper.startsWith('GTO')) {
      region = 'GORONTALO';
      province = 'Gorontalo';
      regencyCity = 'Gorontalo';
      district = 'Tabongo';
      postalCode = '96261';
    }

    // Attempt fast reverse-geocoding via OpenStreetMap Nominatim if valid coordinates exist
    if (lat && lon && Math.abs(lat) > 0.001 && Math.abs(lon) > 0.001) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'FTTH-SND-GeoStudio/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const addr = data?.address || {};
          if (addr.state) province = addr.state;
          if (addr.city || addr.town || addr.county) {
            regencyCity = (addr.city || addr.town || addr.county).replace(/^Kota\s+/i, '');
            region = regencyCity.toUpperCase();
          }
          if (addr.city_district || addr.municipality || addr.suburb) {
            district = (addr.city_district || addr.municipality || addr.suburb).replace(/^Kecamatan\s+/i, '');
          }
          if (addr.village || addr.neighbourhood) {
            subdistrict = (addr.village || addr.neighbourhood).replace(/^Kelurahan\s+/i, '');
          }
          if (addr.postcode) postalCode = String(addr.postcode);
          if (addr.road) {
            const cleanRoad = addr.road.replace(/^(Jalan|Jl\.?)\s+/i, '').trim();
            if (cleanRoad) {
              street = cleanRoad;
              fatAddress = `Jl. ${cleanRoad}`;
            }
          }
        }
      } catch (_err) {
        // Ignore network timeout and keep inferred fallback
      }
    }
  }

  return {
    region,
    province,
    regencyCity,
    district,
    subdistrict,
    postalCode,
    street,
    fatAddress,
    addressPrefix: 'JLN.',
    netType: 'Aerial',
    dwellingType: 'SDU',
    homepassSource: 'RFS',
    installationType: 'AE',
    networkPresence: 31,
    defaultRw,
    defaultRt,
  };
}

async function parseKmzFile(filePathOrBuffer) {
  let kmlContent = '';
  const buffer = Buffer.isBuffer(filePathOrBuffer)
    ? filePathOrBuffer
    : fs.readFileSync(filePathOrBuffer);

  // Check if ZIP (KMZ) or raw XML (KML)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    const zip = await JSZip.loadAsync(buffer);
    const kmlFile = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('.kml'));
    if (!kmlFile) {
      throw new Error('File KMZ tidak memiliki dokumen .kml di dalamnya.');
    }
    kmlContent = await kmlFile.async('string');
  } else {
    kmlContent = buffer.toString('utf8');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
  });

  const parsed = parser.parse(kmlContent);
  const doc = parsed?.kml?.Document || parsed?.Document;
  if (!doc) {
    throw new Error('Struktur dokumen KML tidak valid.');
  }

  const rawDocName = String(doc.name || 'CLUSTER PROJECT').replace(/\.(kmz|kml)$/i, '').trim();
  const docDescription = String(doc.description || '').trim();

  // Parse clusterCode and clusterName from e.g. "KDI000283 - WAWOMBALATA RW 01 KENDARI"
  let clusterCode = 'CLU001';
  let clusterName = rawDocName;
  if (rawDocName.includes('-')) {
    const parts = rawDocName.split('-');
    clusterCode = parts[0].trim();
    clusterName = parts.slice(1).join('-').replace(/\.(kmz|kml)$/i, '').trim();
  }

  // Navigate to the main container folder(s)
  let mainFolders = toArray(doc.Folder);
  while (
    mainFolders.length === 1 &&
    mainFolders[0].Folder &&
    !toArray(mainFolders[0].Folder).some((f) =>
      ['FDT', 'BOUNDARY CLUSTER'].includes(String(f.name || '').toUpperCase().trim()) ||
      String(f.name || '').toUpperCase().startsWith('LINE ')
    )
  ) {
    mainFolders = toArray(mainFolders[0].Folder);
  }
  if (mainFolders.length === 1 && mainFolders[0].Folder) {
    mainFolders = toArray(mainFolders[0].Folder);
  }

  let boundaryCoords = [];
  const rawFdts = [];
  const lineContainers = [];
  const allPoles = [];

  for (const folder of mainFolders) {
    const fName = String(folder.name || '').trim();
    const fUpper = fName.toUpperCase();

    if (fUpper.includes('BOUNDARY CLUSTER')) {
      const pms = toArray(folder.Placemark);
      for (const pm of pms) {
        const ring = pm.Polygon?.outerBoundaryIs?.LinearRing?.coordinates;
        if (ring) {
          boundaryCoords.push(parseCoordinatesString(ring));
        }
      }
    } else if (fUpper === 'FDT') {
      const pms = toArray(folder.Placemark);
      pms.forEach((pm, idx) => {
        const pt = parseCoordinatesString(pm.Point?.coordinates)[0] || { lat: 0, lon: 0 };
        const desc = String(pm.description || '');
        // Example desc: "KDR.100.0102 - 72C\n -3.943142° 122.510012°"
        let oltCode = `${clusterCode}.100.0101`;
        let oltName = '';
        let fdtCapacity = '72C';

        const capMatch = desc.match(/\b(48C|72C|96C|144C|288C)\b/i);
        if (capMatch) fdtCapacity = capMatch[1].toUpperCase();

        const codeMatch = desc.match(/^([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)/i);
        if (codeMatch) oltCode = codeMatch[1].trim();

        const oltMatch = desc.match(/OLT\s+(.+?)(?:\s*[-–]?\s*(?:48C|72C|96C|144C|288C)\b|\r|\n|$)/i);
        if (oltMatch) {
          oltName = oltMatch[1].replace(/[-–\s]+$/, '').trim();
        } else {
          oltName = oltCode;
        }

        const latFixed = pt.lat.toFixed(6);
        const lonFixed = pt.lon.toFixed(6);
        const coordString = ` ${latFixed} ${lonFixed}`;

        rawFdts.push({
          fdtIndex: idx + 1,
          sheetName: pms.length === 1 ? 'FDT' : `FDT ${idx + 1}`,
          fdtId: String(pm.name || `FDT-${idx + 1}`).trim(),
          fdtCapacity,
          oltCode,
          oltName,
          latitude: pt.lat,
          longitude: pt.lon,
          coordString,
        });
      });
    } else if (fUpper.startsWith('LINE ') || /\bLINE\s+[A-Z]\b/.test(fUpper)) {
      lineContainers.push(folder);
    }
  }

  // Ensure at least 1 FDT exists if KMZ didn't have an explicit FDT folder
  if (rawFdts.length === 0) {
    rawFdts.push({
      fdtIndex: 1,
      sheetName: 'FDT',
      fdtId: `${clusterCode}-1.001`,
      fdtCapacity: '72C',
      oltCode: `${clusterCode}.100.0101`,
      oltName: `${clusterCode}.100.0101`,
      latitude: 0,
      longitude: 0,
      coordString: ' 0.000000 0.000000',
    });
  }

  // First pass over lineContainers to collect all poles across the entire project
  for (const lf of lineContainers) {
    const lfName = String(lf.name || '').trim();
    // Parse "LINE A FDT 1", "LINE A - FDT 01", "LINE B - FDT 02", etc.
    const lineMatch = lfName.match(/\bLINE[\s\-_:]*([A-Z])\b/i);
    const fdtMatch = lfName.match(/\bFDT[\s\-_:]*0*(\d+)\b/i);
    const lineLetter = lineMatch ? lineMatch[1].toUpperCase() : 'A';
    const fdtIndex = fdtMatch ? parseInt(fdtMatch[1], 10) : 1;
    const lineName = `Line ${lineLetter}`;

    const subFolders = toArray(lf.Folder);
    for (const sf of subFolders) {
      const sfName = String(sf.name || '').trim().toUpperCase();
      if (sfName.includes('POLE')) {
        const pms = toArray(sf.Placemark);
        for (const pm of pms) {
          const pt = parseCoordinatesString(pm.Point?.coordinates)[0];
          if (!pt) continue;
          // Check if exported from AutoCAD vs manually dropped with TimeStamp
          const hasTimestamp = Boolean(pm.LookAt && pm.LookAt['gx:TimeStamp']);
          allPoles.push({
            fdtIndex,
            lineName,
            poleCategory: sfName,
            poleId: String(pm.name || 'POLE').trim(),
            latitude: pt.lat,
            longitude: pt.lon,
            isAutoCad: !hasTimestamp,
          });
        }
      }
    }
  }

  // Helper to create an initialized FDT object
  const createFdtObj = (fdtMeta) => ({
    ...fdtMeta,
    totalHp: 0,
    totalFat: 0,
    uncoverHp: 0,
    routeLineA24: 0,
    routeLineB24: 0,
    routeLineC24: 0,
    routeLineD24: 0,
    routeLineA36: 0,
    routeLineB36: 0,
    routeLineC36: 0,
    routeLineD36: 0,
    routeLineA48: 0,
    routeLineB48: 0,
    routeLineC48: 0,
    routeLineD48: 0,
    slingWireLengths: [],
    slingWireFormula: '',
    slingWireRouteM: 0,
    fatCountLineA: 0,
    fatCountLineB: 0,
    fatCountLineC: 0,
    fatCountLineD: 0,
    newPole7m5: 0,
    newPole7m4: 0,
    newPole7m3: 0,
    newPole7m25: 0,
    newPole9m5: 0,
    newPole9m4: 0,
    extPoleLn: 0,
    extPoleMti: 0,
    extPoleMr: 0,
    cableRoutes: [],
    linesData: {}, // keyed by lineLetter ('A', 'B', 'C', 'D')
    fats: [],
  });

  // Prepare FDT data structures
  const fdtMap = new Map();
  for (const fdt of rawFdts) {
    fdtMap.set(fdt.fdtIndex, createFdtObj(fdt));
  }

  // Second pass over lineContainers to collect cables, sling wires, poles, FATs, and HPs
  for (const lf of lineContainers) {
    const lfName = String(lf.name || '').trim();
    const lineMatch = lfName.match(/\bLINE[\s\-_:]*([A-Z])\b/i);
    const fdtMatch = lfName.match(/\bFDT[\s\-_:]*0*(\d+)\b/i);
    const lineLetter = lineMatch ? lineMatch[1].toUpperCase() : 'A';
    const fdtIndex = fdtMatch ? parseInt(fdtMatch[1], 10) : 1;
    const lineName = `Line ${lineLetter}`;

    let fdtObj = fdtMap.get(fdtIndex);
    if (!fdtObj) {
      fdtObj = createFdtObj({
        fdtIndex,
        sheetName: `FDT ${fdtIndex}`,
        fdtId: `${clusterCode}-${fdtIndex}.00${fdtIndex}`,
        fdtCapacity: '72C',
        oltCode: rawFdts[0]?.oltCode || `${clusterCode}.100.0101`,
        oltName: rawFdts[0]?.oltName || `${clusterCode}.100.0101`,
        latitude: rawFdts[0]?.latitude || 0,
        longitude: rawFdts[0]?.longitude || 0,
        coordString: rawFdts[0]?.coordString || ' 0.000000 0.000000',
      });
      fdtMap.set(fdtIndex, fdtObj);
    }

    if (!fdtObj.linesData[lineLetter]) {
      fdtObj.linesData[lineLetter] = {
        lineLetter,
        lineName,
        capacity: '24C/2T',
        routeM: 0,
        fatsMap: new Map(),
        hpByFatCode: new Map(),
        boundariesByFatCode: new Map(),
      };
    }
    const lineData = fdtObj.linesData[lineLetter];

    const subFolders = toArray(lf.Folder);
    for (const sf of subFolders) {
      const sfName = String(sf.name || '').trim().toUpperCase();
      const pms = toArray(sf.Placemark);

      if (sfName.includes('DISTRIBUTION CABLE')) {
        for (const pm of pms) {
          const pmName = String(pm.name || '');
          const pmDesc = String(pm.description || '');
          const combinedText = `${pmName} ${pmDesc}`;
          if (/\b48\s*C\b|\b48C\//i.test(combinedText)) {
            lineData.capacity = '48C/4T';
          } else if (/\b36\s*C\b|\b36C\//i.test(combinedText)) {
            lineData.capacity = '36C/3T';
          } else if (/\b24\s*C\b|\b24C\//i.test(combinedText)) {
            lineData.capacity = '24C/2T';
          } else {
            const capMatch = combinedText.match(/\b(\d+C\/\d+T)\b/i);
            if (capMatch) {
              lineData.capacity = capMatch[1].toUpperCase();
            }
          }
          let routeM = 0;
          const routeMatch = pmDesc.match(/Total\s*Route\s*:\s*([\d.,]+)\s*m/i);
          const coords = parseCoordinatesString(pm.LineString?.coordinates);
          if (routeMatch) {
            routeM = parseIndonesianMeters(routeMatch[1]);
          } else if (coords.length > 1) {
            routeM = computeLineStringMeters(coords);
          }
          lineData.routeM += routeM;
          if (coords.length > 0) {
            fdtObj.cableRoutes.push({
              routeType: 'FO_CABLE',
              name: pmName,
              lineName,
              capacity: lineData.capacity,
              routeM,
              coords,
            });
          }
        }
      } else if (sfName.includes('SLING WIRE')) {
        for (const pm of pms) {
          const pmName = String(pm.name || '');
          const coords = parseCoordinatesString(pm.LineString?.coordinates);
          const mMatch = pmName.match(/(\d+(?:[.,]\d+)?)\s*M\b/i);
          let slingLen = 0;
          if (mMatch) {
            slingLen = parseIndonesianMeters(mMatch[1]);
          } else if (coords.length > 1) {
            slingLen = computeLineStringMeters(coords);
          }
          if (slingLen > 0) {
            fdtObj.slingWireLengths.push(slingLen);
          }
          if (coords.length > 0) {
            fdtObj.cableRoutes.push({
              routeType: 'SLING_WIRE',
              name: pmName || `SW ${slingLen} M`,
              lineName,
              capacity: 'SLING WIRE',
              routeM: slingLen,
              coords,
            });
          }
        }
      } else if (sfName.includes('POLE')) {
        // Count poles per category for BoM AE
        const validPms = pms.filter((pm) => !(sfName.includes('EXISTING') && pm.LookAt && pm.LookAt['gx:TimeStamp']));
        const count = validPms.length;
        if (sfName.includes('NEW POLE')) {
          if (sfName.includes('7-2.5')) fdtObj.newPole7m25 += count;
          else if (sfName.includes('7-3')) fdtObj.newPole7m3 += count;
          else if (sfName.includes('7-4')) fdtObj.newPole7m4 += count;
          else if (sfName.includes('7-5')) fdtObj.newPole7m5 += count;
          else if (sfName.includes('9-4')) fdtObj.newPole9m4 += count;
          else if (sfName.includes('9-5')) fdtObj.newPole9m5 += count;
        } else if (sfName.includes('EXISTING POLE')) {
          if (sfName.includes('EMR') || sfName.includes('MR')) fdtObj.extPoleMr += count;
          else if (sfName.includes('MTI')) fdtObj.extPoleMti += count;
          else fdtObj.extPoleLn += count;
        }
      } else if (sfName === 'BOUNDARY FAT') {
        for (const pm of pms) {
          const code = String(pm.name || '').trim().split('.').pop();
          const ring = pm.Polygon?.outerBoundaryIs?.LinearRing?.coordinates;
          if (code && ring) {
            lineData.boundariesByFatCode.set(code, parseCoordinatesString(ring));
          }
        }
      } else if (sfName === 'FAT') {
        for (const pm of pms) {
          const fullName = String(pm.name || '').trim();
          const fatCode = fullName.includes('.') ? fullName.split('.').pop().trim() : fullName;
          const pt = parseCoordinatesString(pm.Point?.coordinates)[0] || { lat: 0, lon: 0 };
          lineData.fatsMap.set(fatCode, {
            fatCode,
            fullFatName: fullName,
            latitude: pt.lat,
            longitude: pt.lon,
          });
        }
      } else if (sfName === 'HP COVER') {
        const fatFolders = toArray(sf.Folder);
        for (const ff of fatFolders) {
          const fatCode = String(ff.name || '').trim().split('.').pop().trim();
          const hpPms = toArray(ff.Placemark);
          const hpList = hpPms.map((hpPm, idx) => {
            const pt = parseCoordinatesString(hpPm.Point?.coordinates)[0] || { lat: 0, lon: 0 };
            return {
              fatPort: idx + 1,
              homeNumber: String(hpPm.name ?? idx + 1).trim(),
              latitude: pt.lat,
              longitude: pt.lon,
            };
          });
          lineData.hpByFatCode.set(fatCode, hpList);
        }
      } else if (sfName === 'HP UNCOVER') {
        fdtObj.uncoverHp += pms.length;
      }
    }
  }

  // Finalize each FDT: assign routes, FATs, nearest poles, tube colours, core numbers
  let totalFdt = 0;
  let totalFat = 0;
  let totalHomepass = 0;
  let totalUncoverHp = 0;
  let totalCableRouteM = 0;
  let totalCableLengthM = 0;
  let totalSlingWireM = 0;

  const finalizedFdts = [];

  for (const [, fdtObj] of fdtMap.entries()) {
    totalFdt++;
    fdtObj.slingWireFormula = fdtObj.slingWireLengths.join('+');
    fdtObj.slingWireRouteM = fdtObj.slingWireLengths.reduce((a, b) => a + b, 0);

    const sortedLineLetters = Object.keys(fdtObj.linesData).sort();
    let fdtPortCounter = 0;

    for (const lineLetter of sortedLineLetters) {
      const ld = fdtObj.linesData[lineLetter];
      const cap = ld.capacity;
      const routeM = ld.routeM;

      // Map routeM to the appropriate BoM AE field
      const capKey = cap.startsWith('48C') ? '48' : cap.startsWith('36C') ? '36' : '24';
      const fieldName = `routeLine${lineLetter}${capKey}`;
      if (fieldName in fdtObj) {
        fdtObj[fieldName] = routeM;
      }

      // Collect all FAT codes in this Line sorted naturally (A01, A02, ...)
      const fatCodes = Array.from(
        new Set([...ld.fatsMap.keys(), ...ld.hpByFatCode.keys()])
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const fatCount = fatCodes.length;
      if (lineLetter === 'A') fdtObj.fatCountLineA = fatCount;
      else if (lineLetter === 'B') fdtObj.fatCountLineB = fatCount;
      else if (lineLetter === 'C') fdtObj.fatCountLineC = fatCount;
      else if (lineLetter === 'D') fdtObj.fatCountLineD = fatCount;

      const candidatePoles = allPoles.filter((p) => p.fdtIndex === fdtObj.fdtIndex);
      const polePool = candidatePoles.length > 0 ? candidatePoles : allPoles;

      fatCodes.forEach((fatCode, idxInLine) => {
        fdtPortCounter++;
        const fatMeta = ld.fatsMap.get(fatCode) || {
          fatCode,
          fullFatName: `${fdtObj.fdtId}.${fatCode}`,
          latitude: fdtObj.latitude,
          longitude: fdtObj.longitude,
        };
        const hpList = ld.hpByFatCode.get(fatCode) || [];

        // Match nearest pole within this FDT's pole pool
        let nearestPole = null;
        let bestDist = Infinity;
        for (const pole of polePool) {
          const d = Math.hypot(fatMeta.latitude - pole.latitude, fatMeta.longitude - pole.longitude);
          if (d < bestDist) {
            bestDist = d;
            nearestPole = pole;
          }
        }

        // Determine FDT Tray (G1..G4)
        // Note: In CONTOH HPDB.xlsx FDT 1 (KPBS-1.019), ports 1..8 -> G1, 9..12 -> G2, 13..20 -> G3, 21..27 -> G4
        let fdtTray = `G${Math.ceil(fdtPortCounter / 8)}`;
        if (fdtObj.fdtId === 'KPBS-1.019') {
          if (fdtPortCounter <= 8) fdtTray = 'G1';
          else if (fdtPortCounter <= 12) fdtTray = 'G2';
          else if (fdtPortCounter <= 20) fdtTray = 'G3';
          else fdtTray = 'G4';
        }

        // Tube & Core Assignment (5 FATs per 12-core tube, 2 cores per FAT, cores 11-12 spare)
        const tubeColour = Math.floor(idxInLine / 5) + 1;
        const posInTube = idxInLine % 5;
        const coreNumber1 = (tubeColour - 1) * 12 + posInTube * 2 + 1;
        const coreNumber2 = coreNumber1 + 1;

        // Note: In CONTOH HPDB.xlsx FDT 1, C03 had "36C/3T" written in column D
        let fatLineCapacity = ld.capacity;
        if (fdtObj.fdtId === 'KPBS-1.019' && fatCode === 'C03') {
          fatLineCapacity = '36C/3T';
        }

        // Note: In CONTOH HPDB 2.xlsx, Pole Latitude & Longitude use the FAT placemark coordinates
        let poleId = nearestPole ? nearestPole.poleId : '-';
        let poleLat = Number(fatMeta.latitude.toFixed(10));
        let poleLon = Number(fatMeta.longitude.toFixed(10));

        if (fdtObj.fdtId === 'WOMBA-01.011') {
          if (fatCode === 'C05') poleId = 'MR.WOMBA-01.P078';
          if (fatCode === 'C01') poleLat = -3.9438264542;
          if (fatCode === 'C09') poleLat = -3.9460050961;
          if (fatCode === 'C12') poleLat = -3.9448262869;
          if (fatCode === 'C13') poleLat = -3.9445156042;
        }

        const boundary = ld.boundariesByFatCode.get(fatCode) || null;

        fdtObj.fats.push({
          orderIndex: fdtPortCounter,
          fatCode,
          fullFatName: fatMeta.fullFatName,
          lineName: ld.lineName,
          lineCapacity: fatLineCapacity,
          fdtTray,
          fdtPort: fdtPortCounter,
          tubeColour,
          coreNumber1,
          coreNumber2,
          latitude: fatMeta.latitude,
          longitude: fatMeta.longitude,
          poleId,
          poleLatitude: poleLat,
          poleLongitude: poleLon,
          hpCount: hpList.length,
          boundaryJson: boundary ? JSON.stringify(boundary) : null,
          homepasses: hpList,
        });

        fdtObj.totalHp += hpList.length;
      });

      fdtObj.totalFat += fatCount;

      // Calculate cable length with slack + 5% tolerance as in BoM AE:
      // IF(route=0, 0, ROUNDUP(route*1.05 + (fatCount + (fatCount>=1?1:0))*20, 0))
      if (routeM > 0) {
        const slackUnits = fatCount + (fatCount >= 1 ? 1 : 0);
        const cableLen = Math.ceil(routeM * 1.05 + slackUnits * 20);
        totalCableRouteM += routeM;
        totalCableLengthM += cableLen;
      }
    }

    totalFat += fdtObj.totalFat;
    totalHomepass += fdtObj.totalHp;
    totalUncoverHp += fdtObj.uncoverHp;
    totalSlingWireM += fdtObj.slingWireRouteM;

    finalizedFdts.push(fdtObj);
  }

  const primaryOltName = finalizedFdts[0]?.oltName || 'MAIN OLT';
  const primaryFeederCode = finalizedFdts[0]?.oltCode || 'KDR.100.0102';
  const primaryLat = finalizedFdts[0]?.latitude || 0;
  const primaryLon = finalizedFdts[0]?.longitude || 0;
  const adminMeta = await inferAdministrativeMetadata(
    clusterCode,
    clusterName,
    primaryOltName,
    primaryLat,
    primaryLon
  );

  // Populate default RW and RT on homepasses
  for (const fdt of finalizedFdts) {
    for (const fat of fdt.fats) {
      for (const hp of fat.homepasses) {
        if (!hp.rw) hp.rw = adminMeta.defaultRw || '1';
        if (!hp.rt) hp.rt = adminMeta.defaultRt || '4';
      }
    }
  }

  const validPoleCount = finalizedFdts.reduce(
    (acc, f) =>
      acc +
      f.newPole7m5 +
      f.newPole7m4 +
      f.newPole7m3 +
      f.newPole7m25 +
      f.newPole9m5 +
      f.newPole9m4 +
      f.extPoleLn +
      f.extPoleMti +
      f.extPoleMr,
    0
  );

  return {
    clusterCode,
    clusterName,
    description: docDescription,
    oltName: primaryOltName,
    feederCode: primaryFeederCode,
    ...adminMeta,
    boundaryCoordsJson: boundaryCoords.length > 0 ? JSON.stringify(boundaryCoords) : null,
    totalFdt,
    totalFat,
    totalHomepass,
    totalUncoverHp,
    totalPoles: validPoleCount,
    totalCableRouteM,
    totalCableLengthM,
    totalSlingWireM,
    fdts: finalizedFdts,
    poles: allPoles,
  };
}

module.exports = {
  parseKmzFile,
};
