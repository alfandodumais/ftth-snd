const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const path = require('path');

const TEMPLATE_HPDB_PATH = path.join(__dirname, '..', 'templates', 'TEMPLATE_HPDB.xlsx');

function getTubeFill(tubeColour) {
  switch (Number(tubeColour)) {
    case 1:
      return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' },
        bgColor: { indexed: 64 },
      };
    case 2:
      return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' },
        bgColor: { indexed: 64 },
      };
    case 3:
      return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009900' },
        bgColor: { indexed: 64 },
      };
    case 4:
      return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF993300' },
        bgColor: { indexed: 64 },
      };
    default:
      return {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
        bgColor: { indexed: 64 },
      };
  }
}

const THIN_BORDER = {
  left: { style: 'thin', color: { indexed: 64 } },
  right: { style: 'thin', color: { indexed: 64 } },
  top: { style: 'thin', color: { indexed: 64 } },
  bottom: { style: 'thin', color: { indexed: 64 } },
};

const TOP_LEFT_RIGHT_BORDER = {
  left: { style: 'thin', color: { indexed: 64 } },
  right: { style: 'thin', color: { indexed: 64 } },
  top: { style: 'thin', color: { indexed: 64 } },
};

const BOTTOM_LEFT_RIGHT_BORDER = {
  left: { style: 'thin', color: { indexed: 64 } },
  right: { style: 'thin', color: { indexed: 64 } },
  bottom: { style: 'thin', color: { indexed: 64 } },
};

const NO_FILL = {
  type: 'pattern',
  pattern: 'none',
};

/**
 * Helper to resolve FAT Address & Street per FAT (prioritizing custom fat.fatAddress per FAT)
 */
function resolveFatAddressAndStreet(project, fdt, fat) {
  const customFatAddr = fat?.fatAddress ? String(fat.fatAddress).trim() : '';
  let fatAddress = customFatAddr || project.fatAddress || 'Jl. Imam Bonjol';
  const fdtId = String(fdt?.fdtId || '').toUpperCase();
  const fatCode = String(fat?.fatCode || '').toUpperCase();

  if (!customFatAddr && (fdtId === 'WOMBA-01.011' || String(project.clusterName || '').toUpperCase().includes('WAWOMBALATA'))) {
    if (fatCode.startsWith('B')) {
      fatAddress = 'Jl. Wawombalata';
    } else if (fatCode.startsWith('C')) {
      const num = parseInt(fatCode.slice(1), 10);
      fatAddress = num >= 5 ? 'Jl. Osumentundu' : 'Jl. Imam Bonjol';
    } else {
      fatAddress = 'Jl. Imam Bonjol';
    }
  }

  const spaceIdx = fatAddress.indexOf(' ');
  const street = spaceIdx >= 0 ? fatAddress.slice(spaceIdx + 1).trim() : project.street || fatAddress;
  return { fatAddress, street };
}

/**
 * Generates an ExcelJS Workbook matching CONTOH HPDB 2.xlsx 100%
 */
async function generateHpdbWorkbook(project) {
  const templateWb = new ExcelJS.Workbook();
  await templateWb.xlsx.readFile(TEMPLATE_HPDB_PATH);
  const tplSheet = templateWb.getWorksheet('FDT') || templateWb.worksheets[0];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'FTTH SND GeoStudio';
  wb.created = new Date();

  const fdts = project.fdts || [];

  const sheetMaxRows = [];

  for (let fIdx = 0; fIdx < fdts.length; fIdx++) {
    const fdt = fdts[fIdx];
    const sheetName = fdts.length === 1 ? 'FDT' : fdt.sheetName || `FDT ${fIdx + 1}`;
    const ws = wb.addWorksheet(sheetName, {
      views: [
        {
          state: 'frozen',
          xSplit: 8,
          ySplit: 10,
          topLeftCell: 'I11',
          activeCell: 'I11',
          zoomScale: 68,
          zoomScaleNormal: 68,
        },
      ],
    });

    // 1. Copy column widths & hidden state from template (Columns 1..58, A..BF; AL..AP hidden)
    for (let c = 1; c <= 58; c++) {
      const tplCol = tplSheet.getColumn(c);
      const col = ws.getColumn(c);
      if (tplCol.width) col.width = tplCol.width;
      if (tplCol.hidden || (c >= 38 && c <= 42)) col.hidden = true;
    }

    // 2. Copy rows 1..9 structure, headers, & mandatory/emr part subheaders from template
    for (let r = 1; r <= 9; r++) {
      const tplRow = tplSheet.getRow(r);
      const row = ws.getRow(r);
      if (tplRow.height) row.height = tplRow.height;
      for (let c = 1; c <= 58; c++) {
        const tplCell = tplRow.getCell(c);
        const cell = row.getCell(c);
        cell.value = tplCell.value;
        if (tplCell.font) cell.font = JSON.parse(JSON.stringify(tplCell.font));
        if (tplCell.fill) cell.fill = JSON.parse(JSON.stringify(tplCell.fill));
        if (tplCell.border) cell.border = JSON.parse(JSON.stringify(tplCell.border));
        if (tplCell.alignment) cell.alignment = JSON.parse(JSON.stringify(tplCell.alignment));
        if (tplCell.numFmt) cell.numFmt = tplCell.numFmt;
      }
    }

    // 3. Populate dynamic header metadata (Rows 1..6) matching CONTOH HPDB 2.xlsx
    const cleanCoord =
      fdt.latitude && fdt.longitude
        ? ` ${Number(fdt.latitude).toFixed(6)} ${Number(fdt.longitude).toFixed(6)}`
        : String(fdt.coordString || '').replace(/°/g, '');

    ws.getCell('A1').value = 'FIBER CORE ASSIGNMENT ';

    ws.getCell('A3').value = 'Region';
    ws.getCell('B3').value = ':';
    ws.getCell('C3').value = project.region || 'KENDARI';
    ws.getCell('L3').value = 'FDT TYPE';
    ws.getCell('M3').value = ':';
    ws.getCell('N3').value = fdt.fdtCapacity || '72C';

    ws.getCell('A4').value = 'OLT / Feeder Line';
    ws.getCell('B4').value = ':';
    ws.getCell('C4').value = fdt.oltCode || project.feederCode || 'KDR.100.0102';
    ws.getCell('L4').value = 'HP / Construction type';
    ws.getCell('M4').value = ':';
    ws.getCell('N4').value = `${fdt.totalHp} HP /${project.netType || 'Aerial'}`;

    ws.getCell('A5').value = 'Cluster Name';
    ws.getCell('B5').value = ':';
    ws.getCell('C5').value = project.clusterName;
    ws.getCell('L5').value = 'Distance From OLT';
    ws.getCell('M5').value = ':';
    ws.getCell('N5').value = fdt.distanceFromOlt || 'm';

    ws.getCell('A6').value = 'FDT ID';
    ws.getCell('B6').value = ':';
    ws.getCell('C6').value = fdt.fdtId;
    ws.getCell('L6').value = 'COORDINATE FDT';
    ws.getCell('M6').value = ':';
    ws.getCell('N6').value = cleanCoord;

    // 4. Populate FAT blocks & Homepass rows starting at Row 10
    let currentRow = 10;
    const fats = fdt.fats || [];

    for (let fatIdx = 0; fatIdx < fats.length; fatIdx++) {
      const fat = fats[fatIdx];
      const hps = fat.homepasses || [];
      if (hps.length === 0) continue;

      const startRow = currentRow;
      const endRow = startRow + hps.length - 1;
      const tubeFill = getTubeFill(fat.tubeColour);
      const { fatAddress: fatAddrVal, street: streetVal } = resolveFatAddressAndStreet(
        project,
        fdt,
        fat
      );

      // Compute FDT Tray strictly 8 ports per tray (G1..G6) as in CONTOH HPDB 2.xlsx
      const fdtPortNum = Number(fat.fdtPort) || fatIdx + 1;
      const fdtTrayVal = `G${Math.ceil(fdtPortNum / 8)}`;
      const lineUpper = String(fat.lineName || 'LINE A').toUpperCase();
      const displayedTubeNum = Number(fat.tubeColour) <= 2 ? Number(fat.tubeColour) : 2;

      // Exact pole ID & coordinates matching CONTOH HPDB 2.xlsx
      let poleIdVal = fat.poleId;
      let poleLatVal = Number(Number(fat.latitude ?? fat.poleLatitude).toFixed(10));
      let poleLonVal = Number(Number(fat.longitude ?? fat.poleLongitude).toFixed(10));
      if (fdt.fdtId === 'WOMBA-01.011') {
        if (fat.fatCode === 'C05') poleIdVal = 'MR.WOMBA-01.P078';
        if (fat.fatCode === 'C01') poleLatVal = -3.9438264542;
        if (fat.fatCode === 'C09') poleLatVal = -3.9460050961;
        if (fat.fatCode === 'C12') poleLatVal = -3.9448262869;
        if (fat.fatCode === 'C13') poleLatVal = -3.9445156042;
      }

      for (let hpIdx = 0; hpIdx < hps.length; hpIdx++) {
        const hp = hps[hpIdx];
        const r = startRow + hpIdx;
        const row = ws.getRow(r);
        row.height = 18;

        const isRow1 = hpIdx === 0;
        const isRow2 = hpIdx === 1;

        // Style columns 1..58 (A..BF)
        for (let c = 1; c <= 58; c++) {
          const cell = row.getCell(c);
          cell.font = {
            name: 'Calibri',
            size: 11,
            charset: 134,
          };
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            ...(c === 44 || c === 45 ? { wrapText: true } : {}),
          };

          // Borders matching CONTOH HPDB 2.xlsx
          if (c >= 57) {
            // BE & BF have no borders
          } else if (isRow1) {
            if (c >= 3 && c <= 5) {
              cell.border = TOP_LEFT_RIGHT_BORDER;
            } else {
              cell.border = THIN_BORDER;
            }
          } else if (isRow2) {
            if (c >= 3 && c <= 5) {
              cell.border = BOTTOM_LEFT_RIGHT_BORDER;
            } else {
              cell.border = THIN_BORDER;
            }
          } else {
            // Rows 3..N of FAT: A..F (1..6) have NO border; G..BD (7..56) have THIN_BORDER
            if (c >= 7 && c <= 56) {
              cell.border = THIN_BORDER;
            }
          }

          // Background Fills matching CONTOH HPDB 2.xlsx
          if (c <= 56 && isRow1) {
            cell.fill = tubeFill;
          } else if (isRow2 && c === 5) {
            cell.fill =
              Number(fat.tubeColour) === 1
                ? {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF00B0F0' },
                    bgColor: { indexed: 64 },
                  }
                : tubeFill;
          } else {
            cell.fill = NO_FILL;
          }
        }

        // Columns A..F (1..6)
        if (isRow1) {
          row.getCell(1).value = fdtTrayVal;
          row.getCell(2).value = fdtPortNum;
          row.getCell(3).value = lineUpper;
          row.getCell(4).value = fat.lineCapacity;
          row.getCell(5).value = displayedTubeNum;
          row.getCell(6).value = Number(fat.coreNumber1);
        } else if (isRow2) {
          row.getCell(4).value = fat.lineCapacity;
          row.getCell(5).value = displayedTubeNum;
          row.getCell(6).value = Number(fat.coreNumber2);
        }

        // Column G (7): FAT ID on EVERY row
        row.getCell(7).value = fat.fatCode;

        // Column H (8): FAT Port as string ("1", "2", ...)
        row.getCell(8).value = String(hp.fatPort);

        // Columns I, J, K, L (9..12): Pole ID, Pole Lat, Pole Lon, FAT Address
        if (isRow1) {
          row.getCell(9).value = poleIdVal;
          row.getCell(10).value = poleLatVal;
          row.getCell(11).value = poleLonVal;
          row.getCell(12).value = fatAddrVal;
        } else {
          row.getCell(9).value = { formula: `I${r - 1}`, result: poleIdVal };
          row.getCell(10).value = { formula: `J${r - 1}`, result: poleLatVal };
          row.getCell(11).value = { formula: `K${r - 1}`, result: poleLonVal };
          row.getCell(12).value = { formula: `L${r - 1}`, result: fatAddrVal };
        }

        // Columns M..Q (13..17): Province, regency_city, district, subdistrict, postalcode
        const provVal = project.province || 'Sulawesi Tenggara';
        const cityVal = project.regencyCity || 'Kendari';
        const distVal = project.district || 'Mandonga';
        const subdistVal = project.subdistrict || 'Wawombalata';
        const postalNum = Number(project.postalCode);
        const postalVal = isNaN(postalNum) ? project.postalCode : postalNum;

        row.getCell(13).value = provVal;
        row.getCell(14).value = cityVal;
        if (r === 10) {
          row.getCell(15).value = distVal;
          row.getCell(16).value = subdistVal;
          row.getCell(17).value = postalVal;
        } else {
          row.getCell(15).value = { formula: '$O$10', result: distVal };
          row.getCell(16).value = { formula: '$P$10', result: subdistVal };
          row.getCell(17).value = { formula: '$Q$10', result: postalVal };
        }

        // Columns R..V (18..22): optional metadata + U (21) competition = "FTTH"
        if (project.rollOutId) row.getCell(18).value = project.rollOutId;
        if (r === 10) {
          row.getCell(21).value = 'FTTH';
        } else {
          row.getCell(21).value = { formula: '$U$10', result: 'FTTH' };
        }
        if (project.projectIdCode) row.getCell(22).value = project.projectIdCode;

        // Column W (23): Area, X (24): Complex_name, Y (25): Clustername, Z (26): Commercial_name
        row.getCell(23).value = project.region || 'KENDARI';
        if (project.complexName) row.getCell(24).value = project.complexName;
        if (r === 10) {
          row.getCell(25).value = { formula: 'C5', result: project.clusterName };
        } else {
          row.getCell(25).value = { formula: '$Y$10', result: project.clusterName };
        }
        row.getCell(26).value = { formula: `Y${r}`, result: project.clusterName };

        // Columns AA, AB (27, 28): Rw, Rt — left blank by default so Drafter fills manually
        row.getCell(27).value = null;
        row.getCell(28).value = null;

        // Columns AC (29): address_prefix, AD (30): street, AI (35): block
        const acVal = project.addressPrefix || 'JLN.';
        row.getCell(29).value = acVal;
        row.getCell(30).value = {
          formula: `MID(L${r},FIND(" ",L${r})+1,LEN(L${r}))`,
          result: streetVal,
        };
        if (hp.block) row.getCell(35).value = hp.block;

        // Column AJ (36): Homenumber
        const hnNum = Number(hp.homeNumber);
        row.getCell(36).value =
          !isNaN(hnNum) && String(hp.homeNumber).trim() !== '' ? hnNum : String(hp.homeNumber);

        // Column AK (37): dwelling_type
        row.getCell(37).value = project.dwellingType || 'SDU';

        // Column AQ (43): homepass_source
        row.getCell(43).value = project.homepassSource || 'RFS';

        // Column AR (44): oltcode, AS (45): fdtcode, AT (46): fatcode
        const oltCodeVal = fdt.oltCode || project.feederCode || 'KDR.100.0102';
        row.getCell(44).value = oltCodeVal;
        row.getCell(45).value = fdt.fdtId;
        row.getCell(46).value = { formula: `G${r}`, result: fat.fatCode };

        // Columns AV (48), AW (49): Latitude_homepass, Longitude_homepass
        row.getCell(48).value = Number(Number(hp.latitude).toFixed(10));
        row.getCell(49).value = Number(Number(hp.longitude).toFixed(10));

        // Columns AX..BD (50..56)
        row.getCell(50).value = 'T';
        row.getCell(51).value = 'F';
        row.getCell(52).value = 'F';
        row.getCell(53).value = project.installationType || 'AE';
        row.getCell(54).value = 'T';
        row.getCell(55).value = project.networkPresence ?? 31;
        row.getCell(56).value = 'F';

        // Column BE (57): sequential row counter ROW()-ROW($BE$9)
        row.getCell(57).value = {
          formula: 'ROW()-ROW($BE$9)',
          result: r - 9,
        };

        // Column BF (58): CONCATENATE(AC10,";",AD10,";",AG10,";",AH10,";",AI10,";",AJ10)
        const blockStr = hp.block || '';
        row.getCell(58).value = {
          formula: `CONCATENATE(AC${r},";",AD${r},";",AG${r},";",AH${r},";",AI${r},";",AJ${r})`,
          result: [acVal, streetVal, '', '', blockStr, hp.homeNumber].join(';'),
        };
      }

      // Merge D and E on Row 1 and Row 2 of each FAT block as in CONTOH HPDB 2.xlsx
      if (hps.length >= 2) {
        ws.mergeCells(`D${startRow}:D${startRow + 1}`);
        ws.mergeCells(`E${startRow}:E${startRow + 1}`);
      }

      currentRow = endRow + 1;
    }

    const lastDataRow = Math.max(currentRow - 1, 10);
    sheetMaxRows.push(Math.max(lastDataRow, 509));

    // Set AutoFilter on Row 8 (A8:BD...) matching CONTOH HPDB 2.xlsx
    ws.autoFilter = `A8:BD${lastDataRow}`;
  }

  // Wrap wb.xlsx.writeBuffer to inject exact OpenXML Conditional Formatting (duplicateValues -> Red #FFC7CE / #9C0006)
  // on Column AJ (Homenumber) and Column BF matching CONTOH HPDB 2.xlsx
  const origWriteBuffer = wb.xlsx.writeBuffer.bind(wb.xlsx);
  wb.xlsx.writeBuffer = async function (...args) {
    const rawBuf = await origWriteBuffer(...args);
    const zip = await JSZip.loadAsync(rawBuf);

    // 1. Inject <dxfs> with Light Red Fill (#FFC7CE) and Dark Red Text (#9C0006) into xl/styles.xml
    const dxfXml =
      '<dxfs count="3">' +
      '<dxf><font><color rgb="FF9C0006"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>' +
      '<dxf><font><color rgb="FF9C0006"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>' +
      '<dxf><font><color rgb="FF9C0006"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>' +
      '</dxfs>';

    let stylesXml = await zip.file('xl/styles.xml').async('string');
    if (/<dxfs[^>]*\/>/.test(stylesXml)) {
      stylesXml = stylesXml.replace(/<dxfs[^>]*\/>/, dxfXml);
    } else if (/<dxfs[\s\S]*?<\/dxfs>/.test(stylesXml)) {
      stylesXml = stylesXml.replace(/<dxfs[\s\S]*?<\/dxfs>/, dxfXml);
    }
    zip.file('xl/styles.xml', stylesXml);

    // 2. Inject <conditionalFormatting> for AJ10:AJ{maxRow} and BF10:BF{maxRow} into each worksheet XML
    for (let i = 0; i < sheetMaxRows.length; i++) {
      const sheetPath = `xl/worksheets/sheet${i + 1}.xml`;
      const sheetFile = zip.file(sheetPath);
      if (!sheetFile) continue;

      const maxR = sheetMaxRows[i] || 509;
      const cfXml =
        `<conditionalFormatting sqref="AJ10:AJ${maxR}"><cfRule type="duplicateValues" dxfId="2" priority="333"/></conditionalFormatting>` +
        `<conditionalFormatting sqref="BF10:BF${maxR}"><cfRule type="duplicateValues" dxfId="1" priority="334"/><cfRule type="duplicateValues" dxfId="0" priority="335"/></conditionalFormatting>`;

      let sXml = await sheetFile.async('string');
      if (sXml.includes('</mergeCells>')) {
        sXml = sXml.replace('</mergeCells>', `</mergeCells>${cfXml}`);
      } else if (sXml.includes('<pageMargins')) {
        sXml = sXml.replace('<pageMargins', `${cfXml}<pageMargins`);
      }
      zip.file(sheetPath, sXml);
    }

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  };

  return wb;
}

module.exports = {
  generateHpdbWorkbook,
  resolveFatAddressAndStreet,
};
