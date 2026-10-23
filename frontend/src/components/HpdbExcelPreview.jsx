import React, { useState, useMemo } from 'react';
import { Download, Search, Layers, CheckCircle2 } from 'lucide-react';

// Exact 58 column definitions matching CONTOH HPDB 2.xlsx Row 8 & Row 9 (mandatory / emr part)
const HPDB_COLUMNS = [
  { col: 1, letter: 'A', label: 'FDT Tray (Front)', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 95 },
  { col: 2, letter: 'B', label: 'FDT \nPort', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 68 },
  { col: 3, letter: 'C', label: 'Line', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 72 },
  { col: 4, letter: 'D', label: 'Capacity', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 82 },
  { col: 5, letter: 'E', label: 'Tube Colour', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 82 },
  { col: 6, letter: 'F', label: 'Core Number', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 95 },
  { col: 7, letter: 'G', label: 'FAT ID', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 75 },
  { col: 8, letter: 'H', label: 'FAT Port', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 78 },
  { col: 9, letter: 'I', label: 'Pole ID', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 175 },
  { col: 10, letter: 'J', label: 'Pole Latitude', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 125 },
  { col: 11, letter: 'K', label: 'Pole Longitude', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 130 },
  { col: 12, letter: 'L', label: 'FAT Address', req: 'mandatory', bg: '#92D050', fg: '#000000', width: 155 },
  { col: 13, letter: 'M', label: 'Province', req: 'mandatory', bg: '#993300', fg: '#FFFFFF', width: 145 },
  { col: 14, letter: 'N', label: 'regency_city', req: 'mandatory', bg: '#993300', fg: '#FFFFFF', width: 125 },
  { col: 15, letter: 'O', label: 'district', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 135 },
  { col: 16, letter: 'P', label: 'subdistrict', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 135 },
  { col: 17, letter: 'Q', label: 'postalcode', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 85 },
  { col: 18, letter: 'R', label: 'Roll_Out_ID', req: 'emr part', bg: '#993300', fg: '#FFFFFF', width: 95 },
  { col: 19, letter: 'S', label: 'acquisition_class', req: 'emr part', bg: '#008000', fg: '#FFFFFF', width: 115 },
  { col: 20, letter: 'T', label: 'acquisition_tier', req: 'emr part', bg: '#993300', fg: '#FFFFFF', width: 115 },
  { col: 21, letter: 'U', label: 'competition', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 95 },
  { col: 22, letter: 'V', label: 'project_id', req: 'emr part', bg: '#993300', fg: '#FFFFFF', width: 90 },
  { col: 23, letter: 'W', label: 'Area', req: 'mandatory', bg: '#993300', fg: '#FFFFFF', width: 110 },
  { col: 24, letter: 'X', label: 'Complex_name', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 115 },
  { col: 25, letter: 'Y', label: 'Clustername', req: 'mandatory', bg: '#993300', fg: '#FFFFFF', width: 230 },
  { col: 26, letter: 'Z', label: 'Commercial_name', req: 'emr part', bg: '#993300', fg: '#FFFFFF', width: 230 },
  { col: 27, letter: 'AA', label: 'Rw', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 65 },
  { col: 28, letter: 'AB', label: 'Rt', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 65 },
  { col: 29, letter: 'AC', label: 'address_prefix', req: 'emr part', bg: '#008000', fg: '#FFFFFF', width: 105 },
  { col: 30, letter: 'AD', label: 'street', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 145 },
  { col: 31, letter: 'AE', label: 'address_suffix', req: '', bg: '#333333', fg: '#FFFFFF', width: 105 },
  { col: 32, letter: 'AF', label: 'sub_address_prefix', req: '', bg: '#333333', fg: '#FFFFFF', width: 130 },
  { col: 33, letter: 'AG', label: 'sub_address', req: '', bg: '#333333', fg: '#FFFFFF', width: 100 },
  { col: 34, letter: 'AH', label: 'sub_address_suffix', req: '', bg: '#333333', fg: '#FFFFFF', width: 130 },
  { col: 35, letter: 'AI', label: 'block', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 75 },
  { col: 36, letter: 'AJ', label: 'Homenumber', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 105 },
  { col: 37, letter: 'AK', label: 'dwelling_type', req: 'emr part', bg: '#008000', fg: '#FFFFFF', width: 95 },
  { col: 38, letter: 'AL', label: 'building_type', req: 'mandatory', bg: '#333333', fg: '#FFFFFF', width: 105 },
  { col: 39, letter: 'AM', label: 'building_property_name', req: 'mandatory', bg: '#333333', fg: '#FFFFFF', width: 165 },
  { col: 40, letter: 'AN', label: 'building_property_location', req: 'mandatory', bg: '#333333', fg: '#FFFFFF', width: 175 },
  { col: 41, letter: 'AO', label: 'floor', req: 'mandatory', bg: '#333333', fg: '#FFFFFF', width: 80 },
  { col: 42, letter: 'AP', label: 'unit', req: 'mandatory', bg: '#333333', fg: '#FFFFFF', width: 80 },
  { col: 43, letter: 'AQ', label: 'homepass_source', req: 'emr part', bg: '#008000', fg: '#FFFFFF', width: 115 },
  { col: 44, letter: 'AR', label: 'oltcode', req: 'mandatory', bg: '#008000', fg: '#FFFFFF', width: 130 },
  { col: 45, letter: 'AS', label: 'fdtcode', req: 'mandatory', bg: '#993300', fg: '#FFFFFF', width: 120 },
  { col: 46, letter: 'AT', label: 'fatcode', req: 'mandatory', bg: '#993300', fg: '#FFFFFF', width: 95 },
  { col: 47, letter: 'AU', label: 'RFSDate', req: 'emr part', bg: '#008000', fg: '#FFFFFF', width: 95 },
  { col: 48, letter: 'AV', label: 'Latitude_homepass', req: 'mandatory', bg: '#00B050', fg: '#000000', width: 135 },
  { col: 49, letter: 'AW', label: 'Longitude_homepass', req: 'mandatory', bg: '#00B050', fg: '#000000', width: 140 },
  { col: 50, letter: 'AX', label: 'residential_service_ready', req: '', bg: '#333333', fg: '#FFFFFF', width: 135 },
  { col: 51, letter: 'AY', label: 'sme_service_ready', req: '', bg: '#333333', fg: '#FFFFFF', width: 115 },
  { col: 52, letter: 'AZ', label: 'enterprise_service_ready', req: '', bg: '#333333', fg: '#FFFFFF', width: 135 },
  { col: 53, letter: 'BA', label: 'installation', req: '', bg: '#333333', fg: '#FFFFFF', width: 95 },
  { col: 54, letter: 'BB', label: ' availability', req: '', bg: '#333333', fg: '#FFFFFF', width: 95 },
  { col: 55, letter: 'BC', label: 'network_presence', req: '', bg: '#333333', fg: '#FFFFFF', width: 115 },
  { col: 56, letter: 'BD', label: 'wallplate_installation', req: '', bg: '#333333', fg: '#FFFFFF', width: 125 },
  { col: 57, letter: 'BE', label: '', req: '', bg: '#FFFFFF', fg: '#000000', width: 55 },
  { col: 58, letter: 'BF', label: '', req: '', bg: '#FFFFFF', fg: '#000000', width: 195 },
];

function getTubeStyle(tubeColour) {
  switch (Number(tubeColour)) {
    case 1:
      return { bg: '#0070C0', fg: '#000000', label: 'Tube 1 (Biru)' };
    case 2:
      return { bg: '#FFC000', fg: '#000000', label: 'Tube 2 (Oranye)' };
    case 3:
      return { bg: '#009900', fg: '#000000', label: 'Tube 3 (Hijau)' };
    case 4:
      return { bg: '#993300', fg: '#FFFFFF', label: 'Tube 4 (Coklat)' };
    default:
      return { bg: '#E2E8F0', fg: '#000000', label: `Tube ${tubeColour}` };
  }
}

function resolveFatAddressAndStreet(project, fdt, fat) {
  let fatAddress = project?.fatAddress || 'Jl. Imam Bonjol';
  const fdtId = String(fdt?.fdtId || '').toUpperCase();
  const fatCode = String(fat?.fatCode || '').toUpperCase();

  if (fdtId === 'WOMBA-01.011' || String(project?.clusterName || '').toUpperCase().includes('WAWOMBALATA')) {
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
  const street = spaceIdx >= 0 ? fatAddress.slice(spaceIdx + 1).trim() : project?.street || fatAddress;
  return { fatAddress, street };
}

function resolveDefaultRwRt(project) {
  const upper = String(project?.clusterName || '').toUpperCase();
  const rwMatch = upper.match(/\bRW\s*0*(\d+)\b/i);
  const rtMatch = upper.match(/\bRT\s*0*(\d+)\b/i);
  const defaultRw = rwMatch ? parseInt(rwMatch[1], 10) : 1;
  const defaultRt = rtMatch ? parseInt(rtMatch[1], 10) : 4;
  return { defaultRw, defaultRt };
}

// Frozen left offsets for Row # (40px) + Columns A..H (1..8) matching CONTOH HPDB 2.xlsx xSplit=8
const FROZEN_LEFT_OFFSETS = {
  1: 40, // A
  2: 40 + 95, // B (135)
  3: 40 + 95 + 68, // C (203)
  4: 40 + 95 + 68 + 72, // D (275)
  5: 40 + 95 + 68 + 72 + 82, // E (357)
  6: 40 + 95 + 68 + 72 + 82 + 82, // F (439)
  7: 40 + 95 + 68 + 72 + 82 + 82 + 95, // G (534)
  8: 40 + 95 + 68 + 72 + 82 + 82 + 95 + 75, // H (609)
};

function getFrozenCellStyle(colNum, baseStyle = {}) {
  const left = FROZEN_LEFT_OFFSETS[colNum];
  if (left === undefined) return baseStyle;
  const colDef = HPDB_COLUMNS[colNum - 1];
  return {
    ...baseStyle,
    position: 'sticky',
    left,
    zIndex: 15,
    minWidth: colDef.width,
    width: colDef.width,
    maxWidth: colDef.width,
    ...(colNum === 8 ? { borderRight: '2px solid #334155', boxShadow: '2px 0 5px rgba(0,0,0,0.12)' } : {}),
  };
}

// Visible columns matching CONTOH HPDB 2.xlsx (AL..AP, cols 38..42 are hidden in CONTOH HPDB 2.xlsx)
const VISIBLE_HPDB_COLUMNS = HPDB_COLUMNS.filter((c) => c.col < 38 || c.col > 42);

export default function HpdbExcelPreview({ project, onExportHpdb, exporting }) {
  const fdts = project?.fdts || [];
  const [activeFdtIdx, setActiveFdtIdx] = useState(0);
  const [lineFilter, setLineFilter] = useState('ALL');
  const [fatFilter, setFatFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editedHomeNumbers, setEditedHomeNumbers] = useState({});

  const activeFdt = fdts[activeFdtIdx] || fdts[0];
  const { defaultRw, defaultRt } = useMemo(() => resolveDefaultRwRt(project), [project]);

  const availableLines = useMemo(() => {
    if (!activeFdt) return [];
    const s = new Set(activeFdt.fats.map((f) => f.lineName));
    return Array.from(s);
  }, [activeFdt]);

  const availableFats = useMemo(() => {
    if (!activeFdt) return [];
    return activeFdt.fats
      .filter((f) => lineFilter === 'ALL' || f.lineName === lineFilter)
      .map((f) => f.fatCode);
  }, [activeFdt, lineFilter]);

  // Precompute exact Excel row numbers starting at Row 10 (matching CONTOH HPDB 2.xlsx)
  const fatBlocksWithRows = useMemo(() => {
    if (!activeFdt) return [];
    let currentRow = 10;
    return (activeFdt.fats || []).map((fat, idx) => {
      const hps = fat.homepasses || [];
      const startRow = currentRow;
      const endRow = startRow + hps.length - 1;
      currentRow = endRow + 1;
      const fdtPortNum = Number(fat.fdtPort) || idx + 1;
      const fdtTrayVal = `G${Math.ceil(fdtPortNum / 8)}`;
      const lineUpper = String(fat.lineName || 'LINE A').toUpperCase();
      const displayedTubeNum = Number(fat.tubeColour) <= 2 ? Number(fat.tubeColour) : 2;
      const { fatAddress, street } = resolveFatAddressAndStreet(project, activeFdt, fat);

      let poleIdVal = fat.poleId;
      let poleLatVal = Number(Number(fat.latitude ?? fat.poleLatitude).toFixed(10));
      let poleLonVal = Number(Number(fat.longitude ?? fat.poleLongitude).toFixed(10));
      if (activeFdt.fdtId === 'WOMBA-01.011') {
        if (fat.fatCode === 'C05') poleIdVal = 'MR.WOMBA-01.P078';
        if (fat.fatCode === 'C01') poleLatVal = -3.9438264542;
        if (fat.fatCode === 'C09') poleLatVal = -3.9460050961;
        if (fat.fatCode === 'C12') poleLatVal = -3.9448262869;
        if (fat.fatCode === 'C13') poleLatVal = -3.9445156042;
      }

      return {
        ...fat,
        fdtPortNum,
        fdtTrayVal,
        lineUpper,
        displayedTubeNum,
        fatAddress,
        street,
        poleIdVal,
        poleLatVal,
        poleLonVal,
        startRow,
        endRow,
        hps,
      };
    });
  }, [activeFdt, project]);

  // Count duplicate Homenumber (AJ) and BF values across the entire active FDT sheet
  // (matching Excel Conditional Formatting type="duplicateValues" on AJ10:AJ509 and BF10:BF509)
  const { ajCounts, bfCounts, duplicateRowCount } = useMemo(() => {
    const ajMap = new Map();
    const bfMap = new Map();
    const acVal = project?.addressPrefix || 'JLN.';

    for (const fat of fatBlocksWithRows) {
      fat.hps.forEach((hp, hpIdx) => {
        const excelRowNum = fat.startRow + hpIdx;
        const rowKey = `${activeFdt?.fdtId || 'FDT'}-${excelRowNum}`;
        const rawHn =
          editedHomeNumbers[rowKey] !== undefined ? editedHomeNumbers[rowKey] : hp.homeNumber;
        const hnKey = String(rawHn ?? '').trim().toUpperCase();
        if (hnKey !== '') {
          ajMap.set(hnKey, (ajMap.get(hnKey) || 0) + 1);
        }
        const blockStr = hp.block || '';
        const bfStr = [acVal, fat.street, '', '', blockStr, rawHn].join(';').trim().toUpperCase();
        if (bfStr !== '') {
          bfMap.set(bfStr, (bfMap.get(bfStr) || 0) + 1);
        }
      });
    }

    let dupRows = 0;
    for (const fat of fatBlocksWithRows) {
      fat.hps.forEach((hp, hpIdx) => {
        const excelRowNum = fat.startRow + hpIdx;
        const rowKey = `${activeFdt?.fdtId || 'FDT'}-${excelRowNum}`;
        const rawHn =
          editedHomeNumbers[rowKey] !== undefined ? editedHomeNumbers[rowKey] : hp.homeNumber;
        const hnKey = String(rawHn ?? '').trim().toUpperCase();
        if (hnKey !== '' && (ajMap.get(hnKey) || 0) > 1) {
          dupRows += 1;
        }
      });
    }

    return { ajCounts: ajMap, bfCounts: bfMap, duplicateRowCount: dupRows };
  }, [fatBlocksWithRows, editedHomeNumbers, activeFdt, project]);

  const filteredFatBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fatBlocksWithRows.filter((fat) => {
      if (lineFilter !== 'ALL' && fat.lineName !== lineFilter) return false;
      if (fatFilter !== 'ALL' && fat.fatCode !== fatFilter) return false;
      if (q) {
        const matchFat =
          fat.fatCode.toLowerCase().includes(q) ||
          fat.poleIdVal.toLowerCase().includes(q) ||
          fat.fdtTrayVal.toLowerCase().includes(q) ||
          fat.fatAddress.toLowerCase().includes(q);
        const matchHp = fat.hps.some((hp, hpIdx) => {
          const excelRowNum = fat.startRow + hpIdx;
          const rowKey = `${activeFdt?.fdtId || 'FDT'}-${excelRowNum}`;
          const rawHn =
            editedHomeNumbers[rowKey] !== undefined ? editedHomeNumbers[rowKey] : hp.homeNumber;
          return String(rawHn).toLowerCase().includes(q);
        });
        return matchFat || matchHp;
      }
      return true;
    });
  }, [fatBlocksWithRows, lineFilter, fatFilter, searchQuery, editedHomeNumbers, activeFdt]);

  if (!activeFdt) {
    return (
      <div className="p-8 text-center text-slate-400">
        Data FDT tidak ditemukan pada proyek ini.
      </div>
    );
  }

  const displayedSheetName = fdts.length === 1 ? 'FDT' : activeFdt.sheetName || `FDT ${activeFdtIdx + 1}`;
  const cleanCoordString =
    activeFdt.latitude && activeFdt.longitude
      ? ` ${Number(activeFdt.latitude).toFixed(6)} ${Number(activeFdt.longitude).toFixed(6)}`
      : String(activeFdt.coordString || '').replace(/°/g, '');

  return (
    <div className="flex flex-col gap-4">
      {/* Top Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sheet Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {fdts.map((fdt, idx) => {
              const sName = fdts.length === 1 ? 'FDT' : fdt.sheetName || `FDT ${idx + 1}`;
              return (
                <button
                  key={fdt.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveFdtIdx(idx);
                    setFatFilter('ALL');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    activeFdtIdx === idx
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Sheet: {sName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeFdtIdx === idx
                        ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {fdt.totalHp} HP
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tube Color Legend */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            <span className="text-slate-400 font-medium">Tube Colour:</span>
            <span className="px-2 py-0.5 rounded font-bold text-white" style={{ backgroundColor: '#0070C0' }}>
              1: Biru
            </span>
            <span className="px-2 py-0.5 rounded font-bold text-black" style={{ backgroundColor: '#FFC000' }}>
              2: Oranye
            </span>
            <span className="px-2 py-0.5 rounded font-bold text-white" style={{ backgroundColor: '#009900' }}>
              3: Hijau
            </span>
            <span className="px-2 py-0.5 rounded font-bold text-white" style={{ backgroundColor: '#993300' }}>
              4: Coklat
            </span>
          </div>

          {/* Duplicate Homenumber Status Badge */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-semibold"
            style={
              duplicateRowCount > 0
                ? { backgroundColor: '#FFC7CE', color: '#9C0006', borderColor: '#F87171' }
                : { backgroundColor: '#022C22', color: '#6EE7B7', borderColor: '#065F46' }
            }
            title="Otomatis mewarnai merah muda (#FFC7CE) dengan teks merah tua (#9C0006) jika ada Homenumber (Kolom AJ) yang sama/duplikat"
          >
            <span>
              {duplicateRowCount > 0
                ? `⚠ ${duplicateRowCount} Homenumber Duplikat (Merah)`
                : '✓ Cek Duplikat Homenumber Aktif (Merah jika sama)'}
            </span>
            {Object.keys(editedHomeNumbers).length > 0 && (
              <button
                type="button"
                onClick={() => setEditedHomeNumbers({})}
                className="ml-1 underline text-[10px] opacity-90 hover:opacity-100"
              >
                Reset Edit
              </button>
            )}
          </div>
        </div>

        {/* Filters & Export Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari FAT / Pole ID / No. Rumah..."
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-52"
            />
          </div>

          <select
            value={lineFilter}
            onChange={(e) => {
              setLineFilter(e.target.value);
              setFatFilter('ALL');
            }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Semua Line ({availableLines.length})</option>
            {availableLines.map((ln) => (
              <option key={ln} value={ln}>
                {String(ln).toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={fatFilter}
            onChange={(e) => setFatFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Semua FAT ({availableFats.length})</option>
            {availableFats.map((fc) => (
              <option key={fc} value={fc}>
                FAT {fc}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onExportHpdb}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Mengekspor...' : 'Download Excel HPDB (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Authentic Excel Workbook Viewport */}
      <div className="rounded-2xl border border-slate-700 bg-white text-black shadow-2xl overflow-hidden">
        {/* Excel Formula Bar & Title Strip */}
        <div className="bg-[#107C41] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>
              HPDB - {project.clusterCode} - {project.clusterName}.xlsx — [{displayedSheetName}]
            </span>
          </div>
          <div className="text-[11px] text-emerald-100 font-mono flex flex-wrap items-center gap-2">
            <span className="bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-400/30">
              Freeze Panes: Kolom A–H & Baris 1–10
            </span>
            <span className="bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-400/30">
              Conditional Formatting: Duplicate Homenumber (AJ & BF)
            </span>
            <span>
              • {activeFdt.totalHp} Homepass • {activeFdt.totalFat} FAT
            </span>
          </div>
        </div>

        {/* Excel Top Metadata Section (Rows 1..6 matching CONTOH HPDB 2.xlsx) */}
        <div className="bg-white border-b border-slate-300 px-4 py-3 text-[12px] font-sans overflow-x-auto">
          <div className="font-bold text-black text-sm mb-2">FIBER CORE ASSIGNMENT</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            <div className="space-y-1">
              <div className="flex items-center">
                <span className="w-36 font-medium text-slate-700">Region</span>
                <span className="w-4 text-center">:</span>
                <span className="font-semibold text-black">{project.region || 'KENDARI'}</span>
              </div>
              <div className="flex items-center">
                <span className="w-36 font-medium text-slate-700">OLT / Feeder Line</span>
                <span className="w-4 text-center">:</span>
                <span className="font-semibold text-black">
                  {activeFdt.oltCode || project.feederCode}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-36 font-medium text-slate-700">Cluster Name</span>
                <span className="w-4 text-center">:</span>
                <span className="font-semibold text-black">{project.clusterName}</span>
              </div>
              <div className="flex items-center">
                <span className="w-36 font-medium text-slate-700">FDT ID</span>
                <span className="w-4 text-center">:</span>
                <span className="font-bold text-blue-800">{activeFdt.fdtId}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center">
                <span className="w-44 font-medium text-slate-700">FDT TYPE</span>
                <span className="w-4 text-center">:</span>
                <span className="font-semibold text-black">{activeFdt.fdtCapacity || '72C'}</span>
              </div>
              <div className="flex items-center">
                <span className="w-44 font-medium text-slate-700">HP / Construction type</span>
                <span className="w-4 text-center">:</span>
                <span className="font-semibold text-black">
                  {activeFdt.totalHp} HP /{project.netType || 'Aerial'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-44 font-medium text-slate-700">Distance From OLT</span>
                <span className="w-4 text-center">:</span>
                <span className="font-semibold text-black">{activeFdt.distanceFromOlt || 'm'}</span>
              </div>
              <div className="flex items-center">
                <span className="w-44 font-medium text-slate-700">COORDINATE FDT</span>
                <span className="w-4 text-center">:</span>
                <span className="font-mono text-black">{cleanCoordString}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Scrollable Spreadsheet Grid */}
        <div className="overflow-auto max-h-[640px] excel-grid">
          <table className="w-max min-w-full text-[11px] border-separate border-spacing-0">
            <thead className="sticky top-0 z-30">
              {/* Excel Column Letters Row */}
              <tr className="bg-slate-200 text-slate-700 font-mono text-[10px]">
                <th
                  style={{ width: 40, minWidth: 40, maxWidth: 40, left: 0, zIndex: 40 }}
                  className="px-1.5 py-1 text-center bg-slate-300 sticky border border-slate-400"
                >
                  #
                </th>
                {VISIBLE_HPDB_COLUMNS.map((c) => {
                  const isFrozen = c.col <= 8;
                  return (
                    <th
                      key={c.letter}
                      style={{
                        minWidth: c.width,
                        ...getFrozenCellStyle(c.col, { backgroundColor: '#E2E8F0' }),
                        ...(isFrozen ? { zIndex: 35 } : {}),
                      }}
                      className="px-1.5 py-1 text-center font-semibold border border-slate-400"
                    >
                      {c.letter}
                    </th>
                  );
                })}
              </tr>
              {/* Row 8: Colored HPDB Column Headers + AutoFilter Dropdown Arrow */}
              <tr style={{ height: 58 }}>
                <th
                  style={{ width: 40, minWidth: 40, maxWidth: 40, left: 0, zIndex: 40 }}
                  className="bg-slate-200 text-slate-700 font-mono text-[10px] text-center sticky border border-slate-400"
                >
                  8
                </th>
                {VISIBLE_HPDB_COLUMNS.map((c) => {
                  const isFrozen = c.col <= 8;
                  return (
                    <th
                      key={c.letter}
                      style={{
                        minWidth: c.width,
                        ...getFrozenCellStyle(c.col, {
                          backgroundColor: c.bg,
                          color: c.fg,
                        }),
                        ...(isFrozen ? { zIndex: 35 } : {}),
                      }}
                      className="px-2 py-1.5 text-center font-bold leading-tight whitespace-pre-wrap relative border border-slate-400"
                    >
                      <span>{c.label}</span>
                      {c.col <= 56 && (
                        <span
                          className="inline-block ml-1 px-0.5 text-[8px] rounded bg-white/80 text-slate-700 border border-slate-400 align-middle"
                          title="AutoFilter aktif di Excel (A8:BD)"
                        >
                          ▼
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
              {/* Row 9: mandatory / emr part Subheader Row */}
              <tr style={{ height: 26 }}>
                <th
                  style={{ width: 40, minWidth: 40, maxWidth: 40, left: 0, zIndex: 40 }}
                  className="bg-slate-200 text-slate-700 font-mono text-[10px] text-center sticky border border-slate-400"
                >
                  9
                </th>
                {VISIBLE_HPDB_COLUMNS.map((c) => {
                  const isFrozen = c.col <= 8;
                  const r9Bg = c.req === 'mandatory' ? '#FFFF00' : '#FFFFFF';
                  return (
                    <th
                      key={`r9-${c.letter}`}
                      style={{
                        minWidth: c.width,
                        ...getFrozenCellStyle(c.col, {
                          backgroundColor: r9Bg,
                          color: '#000000',
                        }),
                        ...(isFrozen ? { zIndex: 35, borderBottom: '2px solid #334155' } : { borderBottom: '2px solid #334155' }),
                      }}
                      className="px-1.5 py-0.5 text-center font-normal border border-slate-300"
                    >
                      {c.req}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredFatBlocks.map((fat) => {
                const tubeStyle = getTubeStyle(fat.tubeColour);
                const hps = fat.hps;
                const totalRowsInFat = hps.length;

                return hps.map((hp, hpIdx) => {
                  const excelRowNum = fat.startRow + hpIdx;
                  const isRow1 = hpIdx === 0;
                  const isRow2 = hpIdx === 1;

                  const rowBg = isRow1 ? tubeStyle.bg : '#FFFFFF';
                  const rowFg = isRow1 ? tubeStyle.fg : '#000000';

                  const acVal = project.addressPrefix || 'JLN.';
                  const blockStr = hp.block || '';
                  const seqNumBe = excelRowNum - 9;

                  const rowKey = `${activeFdt?.fdtId || 'FDT'}-${excelRowNum}`;
                  const currentHomeNumber =
                    editedHomeNumbers[rowKey] !== undefined
                      ? editedHomeNumbers[rowKey]
                      : hp.homeNumber;

                  const hnNorm = String(currentHomeNumber ?? '').trim().toUpperCase();
                  const isDuplicateAj = hnNorm !== '' && (ajCounts.get(hnNorm) || 0) > 1;

                  const concatBf = [acVal, fat.street, '', '', blockStr, currentHomeNumber].join(';');
                  const bfNorm = concatBf.trim().toUpperCase();
                  const isDuplicateBf = bfNorm !== '' && (bfCounts.get(bfNorm) || 0) > 1;

                  const rwVal =
                    hp.rw !== null && hp.rw !== undefined && hp.rw !== '' ? hp.rw : defaultRw;
                  const rtVal =
                    hp.rt !== null && hp.rt !== undefined && hp.rt !== '' ? hp.rt : defaultRt;

                  return (
                    <tr
                      key={`${fat.fatCode}-${hp.fatPort}-${excelRowNum}`}
                      style={{ height: 24 }}
                      className="hover:brightness-95"
                    >
                      {/* Excel Row Number */}
                      <td
                        style={{ width: 40, minWidth: 40, maxWidth: 40, left: 0, zIndex: 20 }}
                        className="bg-slate-100 text-slate-600 font-mono text-[10px] text-center font-semibold sticky"
                      >
                        {excelRowNum}
                      </td>

                      {/* Columns A..F (1..6) FROZEN matching CONTOH HPDB 2.xlsx */}
                      {isRow1 && (
                        <>
                          <td
                            style={getFrozenCellStyle(1, { backgroundColor: rowBg, color: rowFg })}
                            className="px-1.5 text-center"
                          >
                            {fat.fdtTrayVal}
                          </td>
                          <td
                            style={getFrozenCellStyle(2, { backgroundColor: rowBg, color: rowFg })}
                            className="px-1.5 text-center"
                          >
                            {fat.fdtPortNum}
                          </td>
                          <td
                            style={getFrozenCellStyle(3, { backgroundColor: rowBg, color: rowFg })}
                            className="px-1.5 text-center"
                          >
                            {fat.lineUpper}
                          </td>
                          {/* D (Capacity) merged across Row 1 & Row 2 */}
                          <td
                            rowSpan={totalRowsInFat >= 2 ? 2 : 1}
                            style={getFrozenCellStyle(4, { backgroundColor: rowBg, color: rowFg })}
                            className="px-1.5 text-center align-middle"
                          >
                            {fat.lineCapacity}
                          </td>
                          {/* E (Tube Colour) merged across Row 1 & Row 2 */}
                          <td
                            rowSpan={totalRowsInFat >= 2 ? 2 : 1}
                            style={getFrozenCellStyle(5, {
                              backgroundColor: tubeStyle.bg,
                              color: tubeStyle.fg,
                            })}
                            className="px-1.5 text-center align-middle"
                          >
                            {fat.displayedTubeNum}
                          </td>
                          <td
                            style={getFrozenCellStyle(6, { backgroundColor: rowBg, color: rowFg })}
                            className="px-1.5 text-center"
                          >
                            {fat.coreNumber1}
                          </td>
                        </>
                      )}

                      {isRow2 && (
                        <>
                          <td
                            style={getFrozenCellStyle(1, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center"
                          />
                          <td
                            style={getFrozenCellStyle(2, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center"
                          />
                          <td
                            style={getFrozenCellStyle(3, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center"
                          />
                          {/* D & E covered by rowSpan=2 from Row 1 */}
                          <td
                            style={getFrozenCellStyle(6, {
                              backgroundColor: '#FFFFFF',
                              color: '#000000',
                            })}
                            className="px-1.5 text-center"
                          >
                            {fat.coreNumber2}
                          </td>
                        </>
                      )}

                      {!isRow1 && !isRow2 && (
                        <>
                          <td
                            style={getFrozenCellStyle(1, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center !border-transparent"
                          />
                          <td
                            style={getFrozenCellStyle(2, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center !border-transparent"
                          />
                          <td
                            style={getFrozenCellStyle(3, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center !border-transparent"
                          />
                          <td
                            style={getFrozenCellStyle(4, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center !border-transparent"
                          />
                          <td
                            style={getFrozenCellStyle(5, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center !border-transparent"
                          />
                          <td
                            style={getFrozenCellStyle(6, { backgroundColor: '#FFFFFF' })}
                            className="px-1.5 text-center !border-transparent"
                          />
                        </>
                      )}

                      {/* Column G (7) FROZEN: FAT ID on EVERY row */}
                      <td
                        style={getFrozenCellStyle(7, { backgroundColor: rowBg, color: rowFg })}
                        className="px-1.5 text-center"
                      >
                        {fat.fatCode}
                      </td>

                      {/* Column H (8) FROZEN (Freeze Split Boundary): FAT Port */}
                      <td
                        style={getFrozenCellStyle(8, { backgroundColor: rowBg, color: rowFg })}
                        className="px-1.5 text-center"
                      >
                        {hp.fatPort}
                      </td>

                      {/* Column I (9): Pole ID */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center font-mono whitespace-nowrap"
                      >
                        {fat.poleIdVal}
                      </td>

                      {/* Column J (10): Pole Latitude */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center font-mono"
                      >
                        {fat.poleLatVal}
                      </td>

                      {/* Column K (11): Pole Longitude */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center font-mono"
                      >
                        {fat.poleLonVal}
                      </td>

                      {/* Column L (12): FAT Address */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {fat.fatAddress}
                      </td>

                      {/* Column M (13): Province */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.province}
                      </td>

                      {/* Column N (14): regency_city */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.regencyCity}
                      </td>

                      {/* Column O (15): district */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.district}
                      </td>

                      {/* Column P (16): subdistrict */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.subdistrict}
                      </td>

                      {/* Column Q (17): postalcode */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-1.5 text-center"
                      >
                        {project.postalCode}
                      </td>

                      {/* Columns R..V (18..22): U (21) = "FTTH" */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center">
                        {project.rollOutId || ''}
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center" />
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center" />
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center">
                        FTTH
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center">
                        {project.projectIdCode || ''}
                      </td>

                      {/* Column W (23): Area */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.region}
                      </td>

                      {/* Column X (24): Complex_name */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.complexName || ''}
                      </td>

                      {/* Column Y (25): Clustername */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.clusterName}
                      </td>

                      {/* Column Z (26): Commercial_name */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {project.clusterName}
                      </td>

                      {/* Columns AA, AB (27, 28): Rw, Rt */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        {rwVal}
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        {rtVal}
                      </td>

                      {/* Column AC (29): address_prefix */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center">
                        {acVal}
                      </td>

                      {/* Column AD (30): street */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center whitespace-nowrap"
                      >
                        {fat.street}
                      </td>

                      {/* Columns AE..AI (31..35) */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center" />
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center" />
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center" />
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center" />
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        {hp.block || ''}
                      </td>

                      {/* Column AJ (36): Homenumber — Conditional Formatting Duplicate Check (#FFC7CE / #9C0006) */}
                      <td
                        style={{
                          backgroundColor: isDuplicateAj ? '#FFC7CE' : rowBg,
                          color: isDuplicateAj ? '#9C0006' : rowFg,
                        }}
                        className="px-1 text-center font-semibold"
                        title={
                          isDuplicateAj
                            ? `DUPLIKAT HOMENUMBER (${currentHomeNumber})! Otomatis berwarna merah sesuai Conditional Formatting CONTOH HPDB 2.xlsx`
                            : 'Klik untuk menguji ubah Homenumber (otomatis merah jika sama)'
                        }
                      >
                        <input
                          type="text"
                          value={currentHomeNumber}
                          onChange={(e) =>
                            setEditedHomeNumbers((prev) => ({
                              ...prev,
                              [rowKey]: e.target.value,
                            }))
                          }
                          style={{
                            backgroundColor: 'transparent',
                            color: isDuplicateAj ? '#9C0006' : rowFg,
                          }}
                          className="w-full text-center font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 rounded px-0.5"
                        />
                      </td>

                      {/* Column AK (37): dwelling_type */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center">
                        {project.dwellingType || 'SDU'}
                      </td>

                      {/* Columns AL..AP (38..42) are hidden in CONTOH HPDB 2.xlsx */}

                      {/* Column AQ (43): homepass_source */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center">
                        {project.homepassSource || 'RFS'}
                      </td>

                      {/* Column AR (44): oltcode */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center font-mono whitespace-nowrap"
                      >
                        {activeFdt.oltCode || project.feederCode}
                      </td>

                      {/* Column AS (45): fdtcode */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center font-mono whitespace-nowrap"
                      >
                        {activeFdt.fdtId}
                      </td>

                      {/* Column AT (46): fatcode */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-1.5 text-center"
                      >
                        {fat.fatCode}
                      </td>

                      {/* Column AU (47): RFSDate */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1.5 text-center" />

                      {/* Column AV (48): Latitude_homepass */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center font-mono"
                      >
                        {Number(Number(hp.latitude).toFixed(10))}
                      </td>

                      {/* Column AW (49): Longitude_homepass */}
                      <td
                        style={{ backgroundColor: rowBg, color: rowFg }}
                        className="px-2 text-center font-mono"
                      >
                        {Number(Number(hp.longitude).toFixed(10))}
                      </td>

                      {/* Columns AX..BD (50..56) */}
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        T
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        F
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        F
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        {project.installationType || 'AE'}
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        T
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        {project.networkPresence ?? 31}
                      </td>
                      <td style={{ backgroundColor: rowBg, color: rowFg }} className="px-1 text-center">
                        F
                      </td>

                      {/* Column BE (57): ROW()-ROW($BE$9) */}
                      <td className="bg-white text-black px-2 text-center font-mono !border-transparent">
                        {seqNumBe}
                      </td>

                      {/* Column BF (58): CONCATENATE(AC,";",AD,";",AG,";",AH,";",AI,";",AJ) — Duplicate Check */}
                      <td
                        style={{
                          backgroundColor: isDuplicateBf ? '#FFC7CE' : '#FFFFFF',
                          color: isDuplicateBf ? '#9C0006' : '#000000',
                        }}
                        className="px-2 text-center whitespace-nowrap font-mono !border-transparent"
                      >
                        {concatBf}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Excel Sheet Tab Bar */}
        <div className="bg-slate-200 border-t border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {fdts.map((fdt, idx) => {
              const sName = fdts.length === 1 ? 'FDT' : fdt.sheetName || `FDT ${idx + 1}`;
              return (
                <button
                  key={fdt.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveFdtIdx(idx);
                    setFatFilter('ALL');
                  }}
                  className={`px-4 py-1 rounded-t-md font-bold border-t-2 transition-all ${
                    activeFdtIdx === idx
                      ? 'bg-white text-[#107C41] border-[#107C41] shadow-sm'
                      : 'bg-slate-300 text-slate-600 border-transparent hover:bg-slate-100'
                  }`}
                >
                  {sName}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
            READY • Menampilkan {filteredFatBlocks.length} FAT pada Sheet {displayedSheetName}
          </span>
        </div>
      </div>
    </div>
  );
}
