import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Layers,
  Calculator,
  CheckCircle2
} from 'lucide-react';
import { apiFetch } from '../api';

const NRO_COLUMNS = [
  { col: 1, letter: 'A', width: 55 },
  { col: 2, letter: 'B', width: 320 },
  { col: 3, letter: 'C', width: 65 },
  { col: 4, letter: 'D', width: 95 },
  { col: 5, letter: 'E', width: 95 },
  { col: 6, letter: 'F', width: 95 },
  { col: 7, letter: 'G', width: 95 },
  { col: 8, letter: 'H', width: 115 },
  { col: 9, letter: 'I', width: 115 },
  { col: 10, letter: 'J', width: 105 },
  { col: 11, letter: 'K', width: 75 },
  { col: 12, letter: 'L', width: 75 },
  { col: 13, letter: 'M', width: 120 },
  { col: 14, letter: 'N', width: 95 },
  { col: 15, letter: 'O', width: 270 },
  { col: 16, letter: 'P', width: 85 },
  { col: 17, letter: 'Q', width: 85 },
];

const BOM_COLUMNS = [
  { col: 1, letter: 'A', width: 185 },
  { col: 2, letter: 'B', width: 250 },
  { col: 3, letter: 'C', width: 85 },
  { col: 4, letter: 'D', width: 65 },
  { col: 5, letter: 'E', width: 75 },
  { col: 6, letter: 'F', width: 75 },
  { col: 7, letter: 'G', width: 75 },
  { col: 8, letter: 'H', width: 75 },
  { col: 9, letter: 'I', width: 75 },
  { col: 10, letter: 'J', width: 210 },
  { col: 11, letter: 'K', width: 35 },
  { col: 12, letter: 'L', width: 35 },
  { col: 13, letter: 'M', width: 195 },
  { col: 14, letter: 'N', width: 230 },
  { col: 15, letter: 'O', width: 75 },
  { col: 16, letter: 'P', width: 65 },
  { col: 17, letter: 'Q', width: 75 },
  { col: 18, letter: 'R', width: 75 },
  { col: 19, letter: 'S', width: 75 },
  { col: 20, letter: 'T', width: 150 },
];

const SUMMARY_COLUMNS = [
  { col: 1, letter: 'A', width: 220 },
  { col: 2, letter: 'B', width: 180 },
];

const SHEET_TABS = [
  'Summary PO Permit',
  'BoQ NRO Cluster',
  'BoQ NRO All Feeder',
  'BoM AE',
];

function formatCellValue(val, col, rowNumber, sheetName) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    // Material No (Column N = 14 on NRO sheets, or Row 6 O6=482) should not have thousand commas
    if (
      (sheetName === 'BoQ NRO Cluster' || sheetName === 'BoQ NRO All Feeder') &&
      (col === 1 || col === 13 || col === 14 || (rowNumber === 6 && col === 15))
    ) {
      return String(val);
    }
    return Number.isInteger(val)
      ? val.toLocaleString('en-US')
      : val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  return String(val);
}

export default function BoqExcelPreview({ project, onDownloadBoq, exportingBoq }) {
  const [boqData, setBoqData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSheet, setActiveSheet] = useState('BoQ NRO Cluster');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyNonZero, setOnlyNonZero] = useState(false);

  useEffect(() => {
    if (!project?.id) return;
    let mounted = true;
    setLoading(true);
    apiFetch(`/projects/${project.id}/boq-preview`)
      .then((data) => {
        if (mounted) setBoqData(data);
      })
      .catch((err) => {
        console.error('Failed to load BoQ preview:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [project?.id, project?.updatedAt]);

  const poleTotals = useMemo(() => {
    const fdts = project?.fdts || [];
    return fdts.reduce(
      (acc, f) => {
        acc.p725 += f.newPole7m25 || 0;
        acc.p73 += f.newPole7m3 || 0;
        acc.p74 += f.newPole7m4 || 0;
        acc.p94 += f.newPole9m4 || 0;
        acc.ext += (f.extPoleMr || 0) + (f.extPoleMti || 0) + (f.extPoleLn || 0);
        return acc;
      },
      { p725: 0, p73: 0, p74: 0, p94: 0, ext: 0 }
    );
  }, [project]);

  const activeRows = useMemo(() => {
    if (!boqData) return [];
    let rawRows = [];
    if (activeSheet === 'Summary PO Permit') {
      rawRows = boqData.summaryPermitRows || [];
    } else if (activeSheet === 'BoQ NRO Cluster') {
      rawRows = boqData.nroClusterRows || [];
    } else if (activeSheet === 'BoQ NRO All Feeder') {
      rawRows = boqData.nroFeederRows || [];
    } else {
      rawRows = boqData.bomAeRows || [];
    }

    const q = searchTerm.trim().toLowerCase();

    return rawRows.filter((row) => {
      // Always keep top header rows
      if (
        (activeSheet === 'BoQ NRO Cluster' || activeSheet === 'BoQ NRO All Feeder') &&
        row.rowNumber <= 6
      ) {
        return true;
      }
      if (activeSheet === 'BoM AE' && row.rowNumber === 1) {
        return true;
      }
      if (activeSheet === 'Summary PO Permit') {
        return true;
      }

      if (onlyNonZero) {
        if (activeSheet === 'BoQ NRO Cluster' || activeSheet === 'BoQ NRO All Feeder') {
          const c1 = row.cells[0];
          const c3 = row.cells[2];
          const matCell = row.cells[3]; // Col D
          const srvCell = row.cells[4]; // Col E
          const isHeaderOrSubtotal =
            c1?.bgHex === '#A6A6A6' ||
            c1?.bgHex === '#B8CCE4' ||
            (!c3?.value && c1?.value && /^[A-Z0-9.]+$/.test(String(c1.value)));
          const hasQty =
            (typeof matCell?.numericVal === 'number' && matCell.numericVal > 0) ||
            (typeof srvCell?.numericVal === 'number' && srvCell.numericVal > 0);
          if (!isHeaderOrSubtotal && !hasQty) return false;
        } else if (activeSheet === 'BoM AE') {
          const totCell = row.cells[2]; // Col C Qty Total
          const hasQty = typeof totCell?.numericVal === 'number' && totCell.numericVal > 0;
          const isTotalHighlight = row.cells[0]?.bgHex === '#FFFF00';
          if (!hasQty && !isTotalHighlight) return false;
        }
      }

      if (q) {
        return row.cells.some((c) =>
          String(c.value ?? '')
            .toLowerCase()
            .includes(q)
        );
      }

      return true;
    });
  }, [boqData, activeSheet, searchTerm, onlyNonZero]);

  const activeColumns = useMemo(() => {
    if (activeSheet === 'Summary PO Permit') return SUMMARY_COLUMNS;
    if (activeSheet === 'BoM AE') return BOM_COLUMNS;
    return NRO_COLUMNS;
  }, [activeSheet]);

  if (!project) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Top Action & Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sheet Switcher Pills */}
          <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            {SHEET_TABS.map((tabName) => (
              <button
                key={tabName}
                type="button"
                onClick={() => setActiveSheet(tabName)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeSheet === tabName
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{tabName}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyNonZero(!onlyNonZero)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              onlyNonZero
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{onlyNonZero ? 'Filter: Hanya Item Terisi (Qty > 0)' : 'Tampilkan Semua Baris Asli Excel'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari item, No Material SAP, deskripsi..."
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-60"
            />
          </div>

          <button
            type="button"
            onClick={onDownloadBoq}
            disabled={exportingBoq}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingBoq ? 'Mengekspor...' : 'Download Excel BoQ (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Quick BoM Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 text-[11px]">
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Homepass / FDT / FAT</div>
          <div className="font-bold text-white mt-0.5">
            {project.totalHomepass} HP • {project.totalFdt} FDT • {project.totalFat} FAT
          </div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Total Rute Kabel</div>
          <div className="font-bold text-cyan-400 mt-0.5">
            {(project.totalCableRouteM || 0).toLocaleString()} m
          </div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Total Panjang Kabel</div>
          <div className="font-bold text-emerald-400 mt-0.5">
            {(project.totalCableLengthM || 0).toLocaleString()} m
          </div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Rute Strand Wire</div>
          <div className="font-bold text-amber-400 mt-0.5">
            {(project.totalSlingWireM || 0).toLocaleString()} m
          </div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Pole 7m - 2.5&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p725} unit</div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Pole 7m - 3&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p73} unit</div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Pole 7m - 4&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p74} unit</div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Pole 9m - 4&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p94} unit</div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-slate-400">Existing Pole EMR</div>
          <div className="font-bold text-purple-400 mt-0.5">{poleTotals.ext} unit</div>
        </div>
      </div>

      {/* Authentic Excel Workbook Viewport */}
      <div className="rounded-2xl border border-slate-700 bg-white text-black shadow-2xl overflow-hidden">
        {/* Excel Formula Bar & Title Strip */}
        <div className="bg-[#107C41] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>
              BOQ - {project.clusterCode} - {project.clusterName}.xlsx — [{activeSheet}]
            </span>
          </div>
          <div className="text-[11px] text-emerald-100 font-mono flex flex-wrap items-center gap-2">
            <span className="bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-400/30">
              Format Asli CONTOH BOQ.xlsx (PT. EKA MAS REPUBLIK)
            </span>
            <span>
              • {activeRows.length} Baris Ditampilkan
            </span>
          </div>
        </div>

        {/* Main Scrollable Spreadsheet Grid */}
        <div className="overflow-auto max-h-[650px] excel-grid bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-24 bg-slate-950 text-slate-300 text-sm gap-2.5">
              <Calculator className="w-5 h-5 animate-spin text-amber-400" />
              <span>Memuat lembar kerja asli CONTOH BOQ.xlsx ({activeSheet})...</span>
            </div>
          ) : (
            <table className="w-max min-w-full text-[11px] font-sans border-collapse">
              <thead className="sticky top-0 z-30">
                {/* Excel Column Letters Row (A, B, C, ...) */}
                <tr className="bg-slate-200 text-slate-700 font-mono text-[10px]">
                  <th
                    style={{ width: 42, minWidth: 42, maxWidth: 42, left: 0, zIndex: 40 }}
                    className="px-1.5 py-1 text-center bg-slate-300 sticky border border-slate-400"
                  >
                    #
                  </th>
                  {activeColumns.map((c) => (
                    <th
                      key={c.letter}
                      style={{ minWidth: c.width, width: c.width }}
                      className="px-1.5 py-1 text-center font-semibold bg-[#E2E8F0] border border-slate-400"
                    >
                      {c.letter}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {activeRows.map((row) => {
                  const rNum = row.rowNumber;
                  const isNroSheet =
                    activeSheet === 'BoQ NRO Cluster' || activeSheet === 'BoQ NRO All Feeder';
                  const isBomSheet = activeSheet === 'BoM AE';
                  const isSummarySheet = activeSheet === 'Summary PO Permit';

                  // Handle special merged header rows in BoQ NRO Cluster / BoQ NRO All Feeder (Rows 1..5)
                  if (isNroSheet && rNum <= 5) {
                    const cellA = row.cells[0];
                    const cellN = row.cells[13];
                    const cellO = row.cells[14];
                    return (
                      <tr key={rNum} style={{ height: 22 }}>
                        <td
                          style={{ width: 42, minWidth: 42, maxWidth: 42, left: 0, zIndex: 20 }}
                          className="bg-slate-100 text-slate-600 font-mono text-[10px] text-center font-semibold sticky border border-slate-300"
                        >
                          {rNum}
                        </td>
                        {/* Merged A..M (#CC00FF Magenta Banner) */}
                        <td
                          colSpan={13}
                          style={{ backgroundColor: '#CC00FF', color: '#000000' }}
                          className="px-2.5 py-1 font-bold border border-slate-400 whitespace-pre-wrap"
                        >
                          {cellA?.value || ''}
                        </td>
                        {/* Column N Label */}
                        <td
                          style={{
                            backgroundColor: rNum === 1 ? '#DDD9C4' : '#FFFFFF',
                            color: '#000000',
                          }}
                          className="px-2 py-1 font-bold border border-slate-400"
                        >
                          {cellN?.value || ''}
                        </td>
                        {/* Column O Value */}
                        <td
                          style={{
                            backgroundColor:
                              rNum === 1
                                ? '#DDD9C4'
                                : cellO?.bgHex || (rNum === 2 || rNum === 3 || rNum === 5 ? '#92D050' : '#FFFFFF'),
                            color: '#000000',
                          }}
                          className="px-2 py-1 font-bold text-center border border-slate-400"
                        >
                          {formatCellValue(cellO?.value, 15, rNum, activeSheet)}
                        </td>
                        {/* Columns P & Q */}
                        <td
                          style={{ backgroundColor: rNum === 1 ? '#DDD9C4' : '#FFFFFF' }}
                          className="border border-slate-300"
                        />
                        <td className="bg-white border border-slate-300" />
                      </tr>
                    );
                  }

                  // Handle Summary PO Permit Row 1 merged A1:B1
                  if (isSummarySheet && rNum === 1) {
                    const cellA = row.cells[0];
                    return (
                      <tr key={rNum} style={{ height: 26 }}>
                        <td
                          style={{ width: 42, minWidth: 42, maxWidth: 42, left: 0, zIndex: 20 }}
                          className="bg-slate-100 text-slate-600 font-mono text-[10px] text-center font-semibold sticky border border-slate-300"
                        >
                          {rNum}
                        </td>
                        <td
                          colSpan={2}
                          style={{ backgroundColor: '#FFFF00', color: '#000000' }}
                          className="px-3 py-1.5 font-bold text-center border border-slate-500"
                        >
                          {cellA?.value || `Summary PO RT/RW (${project.clusterName})`}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={rNum}
                      style={{ height: isNroSheet && rNum === 6 ? 34 : 22 }}
                      className="hover:brightness-95"
                    >
                      {/* Excel Row Number */}
                      <td
                        style={{ width: 42, minWidth: 42, maxWidth: 42, left: 0, zIndex: 20 }}
                        className="bg-slate-100 text-slate-600 font-mono text-[10px] text-center font-semibold sticky border border-slate-300"
                      >
                        {rNum}
                      </td>

                      {activeColumns.map((colDef) => {
                        const cIdx = colDef.col;
                        const cell = row.cells[cIdx - 1] || {};

                        // Handle merged A14:B14, A28:B28, A48:B48 in BoM AE
                        const isBomMergedRow = isBomSheet && (rNum === 14 || rNum === 28 || rNum === 48);
                        if (isBomMergedRow && cIdx === 2) {
                          return null;
                        }

                        const bgHex = cell.bgHex || '#FFFFFF';
                        const isHeaderRow =
                          (isNroSheet && rNum === 6) || (isBomSheet && rNum === 1);
                        const isBold = Boolean(cell.bold || isHeaderRow || isBomMergedRow);

                        let textAlign = 'text-left';
                        if (isHeaderRow || isBomMergedRow) {
                          textAlign = 'text-center';
                        } else if (isNroSheet) {
                          if (cIdx === 1 || cIdx === 3 || cIdx === 13 || cIdx === 14 || cIdx === 16 || cIdx === 17) {
                            textAlign = 'text-center';
                          } else if (cIdx >= 4 && cIdx <= 12) {
                            textAlign = 'text-right font-mono';
                          }
                        } else if (isBomSheet) {
                          if (cIdx === 4 || cIdx === 16) {
                            textAlign = 'text-center';
                          } else if ((cIdx >= 3 && cIdx <= 9 && cIdx !== 4) || (cIdx >= 15 && cIdx <= 19 && cIdx !== 16)) {
                            textAlign = 'text-right font-mono';
                          }
                        } else if (isSummarySheet && cIdx === 2) {
                          textAlign = 'text-right font-mono';
                        }

                        const formatted = formatCellValue(cell.value, cIdx, rNum, activeSheet);

                        return (
                          <td
                            key={colDef.letter}
                            colSpan={isBomMergedRow && cIdx === 1 ? 2 : 1}
                            title={cell.formula ? `=${cell.formula}` : undefined}
                            style={{
                              backgroundColor: bgHex,
                              color: '#000000',
                              minWidth: colDef.width,
                            }}
                            className={`px-2 py-0.5 border border-slate-300 ${textAlign} ${
                              isBold ? 'font-bold' : 'font-normal'
                            } ${isHeaderRow ? 'border-slate-500 whitespace-pre-wrap' : 'whitespace-nowrap'}`}
                          >
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Excel Sheet Tab Bar matching CONTOH BOQ.xlsx */}
        <div className="bg-slate-200 border-t border-slate-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            {SHEET_TABS.map((tabName) => (
              <button
                key={tabName}
                type="button"
                onClick={() => setActiveSheet(tabName)}
                className={`px-4 py-1 rounded-t-md font-bold border-t-2 transition-all ${
                  activeSheet === tabName
                    ? 'bg-white text-[#107C41] border-[#107C41] shadow-sm'
                    : 'bg-slate-300 text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                {tabName}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
            READY • Menampilkan Sheet &quot;{activeSheet}&quot; sesuai CONTOH BOQ.xlsx
          </span>
        </div>
      </div>
    </div>
  );
}
