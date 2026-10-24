import React, { useState, useRef } from 'react';
import {
  FileCode2,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  Home,
  Navigation,
  Cable,
  X,
  Compass,
  FileCheck,
  Check,
} from 'lucide-react';
import { apiFetch } from '../api';

export default function KmzToDwgModal({ isOpen, onClose, initialFile = null }) {
  const [file, setFile] = useState(initialFile);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      const ext = f.name.toLowerCase();
      if (!ext.endsWith('.kmz') && !ext.endsWith('.kml')) {
        setError('File harus memiliki format .kmz atau .kml (Google Earth).');
        return;
      }
      setFile(f);
      setError('');
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const ext = f.name.toLowerCase();
      if (!ext.endsWith('.kmz') && !ext.endsWith('.kml')) {
        setError('File harus berformat .kmz atau .kml (Google Earth).');
        return;
      }
      setFile(f);
      setError('');
      setResult(null);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError('Pilih file .kmz atau .kml terlebih dahulu.');
      return;
    }
    setConverting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await apiFetch('/convert/kmz-to-dwg', {
        method: 'POST',
        body: formData,
      });

      setResult(data);
    } catch (err) {
      console.error('Convert KMZ to DWG error:', err);
      setError(err.message || 'Gagal mengonversi file KMZ ke AutoCAD DWG.');
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadCad = (url) => {
    if (!url) return;
    const downloadUrl = url.startsWith('/') ? url : `/${url}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Konverter Google Earth KMZ ke AutoCAD (DWG &amp; DXF)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AutoCAD 2018-2026
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Konversi otomatis file survey KMZ ke DWG dengan skala real metrik UTM WGS84, layer FTTH SND &amp; KOP Gambar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                : file
                ? 'border-cyan-500/50 bg-cyan-500/5'
                : 'border-slate-700 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".kmz,.kml"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {(file.size / 1024).toFixed(1)} KB • Siap Dikonversi ke AutoCAD DWG
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-cyan-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  Klik atau seret file <span className="text-cyan-400 font-bold">.kmz</span> atau <span className="text-cyan-400 font-bold">.kml</span> ke sini
                </div>
                <p className="text-[11px] text-slate-500">
                  Mendukung file survey Google Earth dari instrumen GPS / Google Earth Pro
                </p>
              </div>
            )}
          </div>

          {/* Feature Highlights & Specifications */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Spesifikasi As-Plan Drawing AutoCAD FTTH SND:</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                1 Unit = 1.000 Meter (Real)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Layer Standar SND</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Proyeksi UTM WGS84</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>FDT &amp; FAT Symbols</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Layer Home Number</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Tiang 7m, 9m &amp; Ext</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>KOP Gambar &amp; Tabel</span>
              </div>
            </div>
          </div>

          {/* Result Card if Converted */}
          {result && (
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>KMZ Berhasil Dikonversi ke AutoCAD DWG / DXF!</span>
                </div>
                <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full font-bold">
                  {result.preview?.utmProjection || result.stats?.utmProjection || 'UTM WGS84'}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Home className="w-3 h-3 text-emerald-400" /> Homepass
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">
                    {result.preview?.totalHomepass || result.stats?.totalHomepass || 0} HP
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-400" /> FAT &amp; FDT
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">
                    {result.preview?.totalFat || result.stats?.totalFat || 0} FAT / {result.preview?.totalFdt || result.stats?.totalFdt || 1} FDT
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Navigation className="w-3 h-3 text-amber-400" /> Tiang (Poles)
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">
                    {result.stats?.totalPoles || result.preview?.totalPoles || 0} Tiang
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Cable className="w-3 h-3 text-purple-400" /> Panjang Rute
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">
                    {result.preview?.totalCableRouteM || result.stats?.totalCableRouteM || 0} m
                  </div>
                </div>
              </div>

              {/* Download Action Buttons: Dual Format DWG & DXF */}
              <div className="pt-2 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Button 1: Download DWG */}
                  <button
                    type="button"
                    onClick={() => handleDownloadCad(result.downloadDwgUrl || result.downloadDxfUrl)}
                    className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all cursor-pointer group"
                  >
                    <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    <span>Download AutoCAD DWG (.dwg)</span>
                  </button>

                  {/* Button 2: Download DXF */}
                  <button
                    type="button"
                    onClick={() => handleDownloadCad(result.downloadDxfUrl)}
                    className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white font-extrabold text-xs border border-cyan-500/40 hover:border-cyan-400 shadow-md transition-all cursor-pointer group"
                  >
                    <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    <span>Download AutoCAD DXF (.dxf)</span>
                  </button>
                </div>

                {/* Info Card: Autodesk DXF & DWG Full Compatibility */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-3 text-xs text-left">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <FileCode2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="font-extrabold text-white flex items-center justify-between gap-2">
                      <span>Dua Pilihan Format AutoCAD (DWG &amp; DXF)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
                        AutoCAD 2018-2026
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Kedua format gambar ini dapat <strong>langsung dibuka di AutoCAD, Civil 3D &amp; ZwCAD</strong>. Seluruh Layer FTTH SND, Simbol Tiang 7m/9m, FAT, FDT, jalur kabel metrik UTM WGS84, dan KOP Gambar terpetakan secara presisi dan siap di-plot/cetak.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {file ? `File terpilih: ${file.name}` : 'Pilih file .kmz atau .kml untuk memulai konversi'}
          </div>

          <div className="flex items-center gap-2">
            {!result ? (
              <button
                type="button"
                onClick={handleConvert}
                disabled={!file || converting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {converting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengonversi ke DWG...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Mulai Konversi ke DWG</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                <span>Konversi File Lain</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
