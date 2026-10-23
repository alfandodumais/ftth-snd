import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Layers,
  Calculator
} from 'lucide-react';
import { apiFetch } from '../api';

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

  const getCellVal = (row, colIndex1Based) => {
    const cell = row?.cells?.[colIndex1Based - 1];
    return cell ? cell.value : '';
  };

  const getCellFormula = (row, colIndex1Based) => {
    const cell = row?.cells?.[colIndex1Based - 1];
    return cell?.formula || null;
  };

  const filteredNroRows = useMemo(() => {
    if (!boqData?.nroClusterRows) return [];
    const q = searchTerm.trim().toLowerCase();
    return boqData.nroClusterRows.filter((row) => {
      if (row.rowNumber <= 9) return false;
      const secCode = String(getCellVal(row, 2) || '');
      const desc = String(getCellVal(row, 3) || '');
      const sapText = String(getCellVal(row, 4) || '');
      const matNo = String(getCellVal(row, 5) || '');
      const uom = String(getCellVal(row, 6) || '');
      const matQty = getCellVal(row, 7);
      const srvQty = getCellVal(row, 8);
      const remarks = String(getCellVal(row, 11) || '');
      const isSection = Boolean(secCode && /^[A-Z](\.\d+)?$/.test(secCode) && !uom);

      if (onlyNonZero) {
        const hasVal =
          (typeof matQty === 'number' && matQty > 0) ||
          (typeof srvQty === 'number' && srvQty > 0) ||
          isSection;
        if (!hasVal) return false;
      }
      if (!q) return true;
      return (
        desc.toLowerCase().includes(q) ||
        sapText.toLowerCase().includes(q) ||
        matNo.toLowerCase().includes(q) ||
        secCode.toLowerCase().includes(q) ||
        remarks.toLowerCase().includes(q)
      );
    });
  }, [boqData, searchTerm, onlyNonZero]);

  const filteredBomRows = useMemo(() => {
    if (!boqData?.bomAeRows) return [];
    const q = searchTerm.trim().toLowerCase();
    return boqData.bomAeRows.filter((row) => {
      if (row.rowNumber <= 12) return false;
      const no = String(getCellVal(row, 1) || '');
      const matType = String(getCellVal(row, 2) || '');
      const qtyTotal = getCellVal(row, 3);
      const unit = String(getCellVal(row, 4) || '');
      const remarks = String(getCellVal(row, 10) || '');

      if (onlyNonZero) {
        const hasVal =
          (typeof qtyTotal === 'number' && qtyTotal > 0) ||
          (!unit && matType);
        if (!hasVal) return false;
      }
      if (!q) return true;
      return (
        matType.toLowerCase().includes(q) ||
        remarks.toLowerCase().includes(q) ||
        no.toLowerCase().includes(q)
      );
    });
  }, [boqData, searchTerm, onlyNonZero]);

  const formatNum = (val) => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
      return Number.isInteger(val)
        ? val.toLocaleString('en-US')
        : val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }
    return String(val);
  };

  // Aggregate pole totals from fdts
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

  if (!project) return null;

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <FileSpreadsheet className="w-4 h-4" />
            <span>CONTOH BOQ.xlsx (Format Standar SAP NRO &amp; BoM AE)</span>
          </div>
          <span className="text-xs text-slate-400 hidden md:inline">
            Sheet Aktif: <strong className="text-white">{activeSheet}</strong> • Rumus Excel Terkalkulasi Otomatis
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOnlyNonZero(!onlyNonZero)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              onlyNonZero
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{onlyNonZero ? 'Hanya Item Terisi (Qty > 0)' : 'Tampilkan Semua Baris Excel'}</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari item material, kode SAP, remarks..."
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-60"
            />
          </div>

          <button
            onClick={onDownloadBoq}
            disabled={exportingBoq}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingBoq ? 'Generating BoQ...' : 'Download Excel BoQ (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Quick BoM Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2 px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 text-[11px]">
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Homepass / FDT / FAT</div>
          <div className="font-bold text-white mt-0.5">
            {project.totalHomepass} HP • {project.totalFdt} FDT • {project.totalFat} FAT
          </div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Length of Route</div>
          <div className="font-bold text-cyan-400 mt-0.5">{formatNum(project.totalCableRouteM)} m</div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">FO Cable 48C</div>
          <div className="font-bold text-emerald-400 mt-0.5">{formatNum(project.totalCableLengthM)} m</div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Sling Wire</div>
          <div className="font-bold text-amber-400 mt-0.5">{formatNum(project.totalSlingWireM)} m</div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Pole 7m - 2.5&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p725} Ea</div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Pole 7m - 3&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p73} Ea</div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Pole 7m - 4&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p74} Ea</div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Pole 9m - 4&quot;</div>
          <div className="font-bold text-white mt-0.5">{poleTotals.p94} Ea</div>
        </div>
        <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
          <div className="text-slate-400">Existing Pole EMR</div>
          <div className="font-bold text-purple-400 mt-0.5">{poleTotals.ext} Ea</div>
        </div>
      </div>

      {/* Main Excel Grid Area */}
      <div className="overflow-auto max-h-[620px] bg-white text-black select-text">
        {loading ? (
          <div className="flex items-center justify-center py-24 bg-slate-950 text-slate-400 text-sm gap-2">
            <Calculator className="w-5 h-5 animate-spin text-amber-400" />
            <span>Memuat kalkulasi sel Excel BoQ NRO Cluster &amp; BoM AE...</span>
          </div>
        ) : activeSheet === 'BoQ NRO Cluster' ? (
          <table className="border-collapse text-[11px] font-sans min-w-max w-full">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr className="bg-[#f3f4f6] text-[#4b5563] border-b border-[#d1d5db] text-[10px]">
                <th className="border border-[#d1d5db] px-2 py-0.5 w-10 text-center font-normal bg-[#e5e7eb]">Row</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">B</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">C</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">D</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">E</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">F</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">G</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">H</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">K</th>
              </tr>

              <tr className="bg-[#FFF2CC] text-black border-b border-black">
                <td className="border border-gray-400 bg-[#e5e7eb] text-center font-mono text-[10px]">2-7</td>
                <td colSpan={8} className="border border-gray-400 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wide">
                        BILL OF QUANTITY (BoQ) NRO CLUSTER — {project.clusterName}
                      </div>
                      <div className="text-[11px] text-gray-700 mt-0.5">
                        Cluster Code: <strong>{project.clusterCode}</strong> • Region: <strong>{project.region}</strong> • City: <strong>{project.regencyCity}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] bg-white/80 px-3 py-1 rounded border border-amber-300">
                      <span>1. Jumlah HomePass: <strong>{project.totalHomepass} HP</strong></span>
                      <span>2. Jumlah FDT: <strong>{project.totalFdt} Unit</strong></span>
                      <span>3. Jumlah FAT: <strong>{project.totalFat} Unit</strong></span>
                    </div>
                  </div>
                </td>
              </tr>

              <tr className="bg-[#1F4E78] text-white font-bold">
                <th rowSpan={2} className="border border-black px-2 py-1.5 text-center bg-[#e5e7eb] text-gray-700">
                  #
                </th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 text-center w-14">
                  No
                </th>
                <th rowSpan={2} className="border border-black px-3 py-1.5 text-left min-w-[280px]">
                  Description / Scope of Work
                </th>
                <th rowSpan={2} className="border border-black px-3 py-1.5 text-left min-w-[260px]">
                  SAP Short Text
                </th>
                <th rowSpan={2} className="border border-black px-2.5 py-1.5 text-center w-28">
                  Material No.
                </th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 text-center w-16">
                  UoM
                </th>
                <th colSpan={2} className="border border-black px-2 py-1 text-center bg-[#2F5597]">
                  Total Quantity
                </th>
                <th rowSpan={2} className="border border-black px-3 py-1.5 text-left min-w-[240px]">
                  Remarks / Formula Link
                </th>
              </tr>
              <tr className="bg-[#2F5597] text-white font-bold">
                <th className="border border-black px-2.5 py-1 text-right w-24">Material</th>
                <th className="border border-black px-2.5 py-1 text-right w-24">Service (Jasa)</th>
              </tr>
            </thead>

            <tbody>
              {filteredNroRows.map((row) => {
                const secCode = getCellVal(row, 2);
                const desc = getCellVal(row, 3);
                const sapText = getCellVal(row, 4);
                const matNo = getCellVal(row, 5);
                const uom = getCellVal(row, 6);
                const matQty = getCellVal(row, 7);
                const srvQty = getCellVal(row, 8);
                const remarks = getCellVal(row, 11);

                const isSection = Boolean(secCode && /^[A-Z](\.\d+)?$/.test(String(secCode)) && !uom);
                const hasQty =
                  (typeof matQty === 'number' && matQty > 0) ||
                  (typeof srvQty === 'number' && srvQty > 0);

                if (isSection) {
                  return (
                    <tr key={row.rowNumber} className="bg-[#D9E1F2] font-bold text-black">
                      <td className="border border-gray-300 bg-[#f3f4f6] text-gray-600 text-center font-mono text-[10px]">
                        {row.rowNumber}
                      </td>
                      <td className="border border-gray-400 px-2 py-1.5 text-center">{secCode}</td>
                      <td colSpan={7} className="border border-gray-400 px-3 py-1.5">
                        {desc}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.rowNumber}
                    className={`border-b border-gray-300 transition ${
                      hasQty ? 'bg-[#E2EFDA]/70 hover:bg-[#C6E0B4]/60 font-medium' : 'bg-white hover:bg-blue-50/40 text-gray-700'
                    }`}
                  >
                    <td className="border border-gray-300 bg-[#f3f4f6] text-gray-600 text-center font-mono text-[10px] px-1.5">
                      {row.rowNumber}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{secCode}</td>
                    <td className="border border-gray-300 px-3 py-1">{desc}</td>
                    <td className="border border-gray-300 px-3 py-1 text-gray-700">{sapText}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-mono text-[10.5px]">
                      {matNo}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{uom}</td>
                    <td
                      title={getCellFormula(row, 7) ? `=${getCellFormula(row, 7)}` : undefined}
                      className={`border border-gray-300 px-2.5 py-1 text-right font-mono ${
                        typeof matQty === 'number' && matQty > 0
                          ? 'font-bold text-emerald-900 bg-[#C6E0B4]'
                          : ''
                      }`}
                    >
                      {formatNum(matQty)}
                    </td>
                    <td
                      title={getCellFormula(row, 8) ? `=${getCellFormula(row, 8)}` : undefined}
                      className={`border border-gray-300 px-2.5 py-1 text-right font-mono ${
                        typeof srvQty === 'number' && srvQty > 0
                          ? 'font-bold text-blue-900 bg-[#BDD7EE]'
                          : ''
                      }`}
                    >
                      {formatNum(srvQty)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-gray-600 text-[10.5px]">
                      {remarks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Sheet 2: BoM AE */
          <table className="border-collapse text-[11px] font-sans min-w-max w-full">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr className="bg-[#f3f4f6] text-[#4b5563] border-b border-[#d1d5db] text-[10px]">
                <th className="border border-[#d1d5db] px-2 py-0.5 w-10 text-center font-normal bg-[#e5e7eb]">Row</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">A</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">B</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">C</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">D</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">E</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">F</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">G</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">H</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">I</th>
                <th className="border border-[#d1d5db] px-2 py-0.5 text-center font-normal">J</th>
              </tr>

              <tr className="bg-[#D9E1F2] text-black">
                <td className="border border-gray-400 bg-[#e5e7eb] text-center font-mono text-[10px]">1-12</td>
                <td colSpan={10} className="border border-gray-400 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between">
                    <div>
                      <span className="font-bold text-xs">BILL OF MATERIAL (BoM AE) — {project.clusterName}</span>
                      <span className="ml-3 text-gray-700">
                        Area: <strong>{project.regencyCity}</strong> • OLT: <strong>{project.oltName || '-'}</strong>
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-blue-900">
                      Breakdown Otomatis per FDT (FDT-1 s/d FDT-5)
                    </div>
                  </div>
                </td>
              </tr>

              <tr className="bg-[#1F4E78] text-white font-bold">
                <th rowSpan={2} className="border border-black px-2 py-1.5 text-center bg-[#e5e7eb] text-gray-700">
                  #
                </th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 text-center w-12">
                  No
                </th>
                <th rowSpan={2} className="border border-black px-3 py-1.5 text-left min-w-[280px]">
                  Material Type / Item Description
                </th>
                <th rowSpan={2} className="border border-black px-2.5 py-1.5 text-right w-24 bg-[#2F5597]">
                  Qty Total
                </th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 text-center w-16">
                  Unit
                </th>
                <th colSpan={5} className="border border-black px-2 py-1 text-center bg-[#2F5597]">
                  FDT Breakdown (Cluster Distribution)
                </th>
                <th rowSpan={2} className="border border-black px-3 py-1.5 text-left min-w-[260px]">
                  REMARKS
                </th>
              </tr>
              <tr className="bg-[#2F5597] text-white font-bold">
                <th className="border border-black px-2.5 py-1 text-right w-20">FDT-1</th>
                <th className="border border-black px-2.5 py-1 text-right w-20">FDT-2</th>
                <th className="border border-black px-2.5 py-1 text-right w-20">FDT-3</th>
                <th className="border border-black px-2.5 py-1 text-right w-20">FDT-4</th>
                <th className="border border-black px-2.5 py-1 text-right w-20">FDT-5</th>
              </tr>
            </thead>

            <tbody>
              {filteredBomRows.map((row) => {
                const no = getCellVal(row, 1);
                const matType = getCellVal(row, 2);
                const qtyTotal = getCellVal(row, 3);
                const unit = getCellVal(row, 4);
                const fdt1 = getCellVal(row, 5);
                const fdt2 = getCellVal(row, 6);
                const fdt3 = getCellVal(row, 7);
                const fdt4 = getCellVal(row, 8);
                const fdt5 = getCellVal(row, 9);
                const remarks = getCellVal(row, 10);

                const isCategoryHeader = !unit && matType && typeof no === 'string' && /^[A-Z]$/i.test(no);
                const hasQty = typeof qtyTotal === 'number' && qtyTotal > 0;

                if (isCategoryHeader) {
                  return (
                    <tr key={row.rowNumber} className="bg-[#FFF2CC] font-bold text-black">
                      <td className="border border-gray-300 bg-[#f3f4f6] text-gray-600 text-center font-mono text-[10px]">
                        {row.rowNumber}
                      </td>
                      <td className="border border-gray-400 px-2 py-1.5 text-center">{no}</td>
                      <td colSpan={9} className="border border-gray-400 px-3 py-1.5">
                        {matType}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.rowNumber}
                    className={`border-b border-gray-300 ${
                      hasQty ? 'bg-[#E2EFDA]/70 font-medium' : 'bg-white text-gray-700'
                    }`}
                  >
                    <td className="border border-gray-300 bg-[#f3f4f6] text-gray-600 text-center font-mono text-[10px]">
                      {row.rowNumber}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{no}</td>
                    <td className="border border-gray-300 px-3 py-1">{matType}</td>
                    <td
                      title={getCellFormula(row, 3) ? `=${getCellFormula(row, 3)}` : undefined}
                      className={`border border-gray-300 px-2.5 py-1 text-right font-mono ${
                        hasQty ? 'font-bold bg-[#C6E0B4] text-emerald-950' : ''
                      }`}
                    >
                      {formatNum(qtyTotal)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{unit}</td>
                    <td className="border border-gray-300 px-2.5 py-1 text-right font-mono">
                      {formatNum(fdt1)}
                    </td>
                    <td className="border border-gray-300 px-2.5 py-1 text-right font-mono">
                      {formatNum(fdt2)}
                    </td>
                    <td className="border border-gray-300 px-2.5 py-1 text-right font-mono">
                      {formatNum(fdt3)}
                    </td>
                    <td className="border border-gray-300 px-2.5 py-1 text-right font-mono">
                      {formatNum(fdt4)}
                    </td>
                    <td className="border border-gray-300 px-2.5 py-1 text-right font-mono">
                      {formatNum(fdt5)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-gray-600 text-[10.5px]">
                      {remarks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Excel Sheet Tabs Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#e5e7eb] border-t border-gray-300 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSheet('BoQ NRO Cluster')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-t-md font-semibold border-b-2 transition ${
              activeSheet === 'BoQ NRO Cluster'
                ? 'bg-white text-amber-700 border-amber-600 shadow-sm'
                : 'bg-gray-200 text-gray-600 border-transparent hover:bg-gray-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>BoQ NRO Cluster</span>
          </button>

          <button
            onClick={() => setActiveSheet('BoM AE')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-t-md font-semibold border-b-2 transition ${
              activeSheet === 'BoM AE'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-sm'
                : 'bg-gray-200 text-gray-600 border-transparent hover:bg-gray-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>BoM AE (FDT Breakdown)</span>
          </button>

          <span className="ml-3 text-[11px] text-gray-500 hidden sm:inline">
            + Sheet &quot;BoQ NRO All Feeder&quot; &amp; &quot;Summary PO Permit&quot; disertakan otomatis saat Download Excel (.xlsx)
          </span>
        </div>

        <div className="text-[11px] text-gray-600 font-medium">
          Sinkron 100% dengan Template SAP &amp; BoM AE
        </div>
      </div>
    </div>
  );
}
