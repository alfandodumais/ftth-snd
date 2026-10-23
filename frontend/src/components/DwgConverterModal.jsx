import React, { useState, useRef } from 'react';
import {
  FileCode2,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  MapPin,
  Layers,
  Home,
  Navigation,
  Cable,
  X,
  Compass,
} from 'lucide-react';
import { apiFetch } from '../api';

export default function DwgConverterModal({ isOpen, onClose, onProjectCreated }) {
  const [file, setFile] = useState(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [anchorLat, setAnchorLat] = useState('');
  const [anchorLon, setAnchorLon] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [clusterCode, setClusterCode] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith('.dwg')) {
        setError('File harus memiliki format .dwg (AutoCAD Drawing).');
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
      if (!f.name.toLowerCase().endsWith('.dwg')) {
        setError('File harus berformat .dwg (AutoCAD Drawing).');
        return;
      }
      setFile(f);
      setError('');
      setResult(null);
    }
  };

  const handleConvert = async (downloadImmediate = false) => {
    if (!file) {
      setError('Pilih file .dwg terlebih dahulu.');
      return;
    }
    setConverting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (anchorLat) formData.append('anchorLat', anchorLat);
      if (anchorLon) formData.append('anchorLon', anchorLon);
      if (clusterName) formData.append('clusterName', clusterName);
      if (clusterCode) formData.append('clusterCode', clusterCode);

      const endpoint = downloadImmediate ? '/convert/dwg-to-kmz?download=true' : '/convert/dwg-to-kmz';
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      setResult(data);
      if (data.metadata) {
        if (!anchorLat && data.metadata.anchorLat) setAnchorLat(String(data.metadata.anchorLat));
        if (!anchorLon && data.metadata.anchorLon) setAnchorLon(String(data.metadata.anchorLon));
        if (!clusterName && data.metadata.clusterName) setClusterName(data.metadata.clusterName);
        if (!clusterCode && data.metadata.clusterCode) setClusterCode(data.metadata.clusterCode);
      }
    } catch (err) {
      console.error('Convert DWG error:', err);
      setError(err.message || 'Gagal mengonversi file DWG ke KMZ.');
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadKmz = () => {
    if (!result?.downloadUrl) return;
    const downloadUrl = result.downloadUrl.startsWith('/') ? result.downloadUrl : `/${result.downloadUrl}`;
    window.open(downloadUrl, '_blank');
  };

  const handleOpenInStudio = async () => {
    if (!file) return;
    setConverting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('kmzFile', file);
      if (clusterName) formData.append('clusterName', clusterName);
      if (clusterCode) formData.append('clusterCode', clusterCode);
      if (anchorLat) formData.append('anchorLat', anchorLat);
      if (anchorLon) formData.append('anchorLon', anchorLon);

      const data = await apiFetch('/projects/upload', {
        method: 'POST',
        body: formData,
      });

      if (data.project) {
        if (onProjectCreated) {
          onProjectCreated(data.project);
        }
        onClose();
      }
    } catch (err) {
      console.error('Open in studio error:', err);
      setError(err.message || 'Gagal membuka proyek DWG di GeoStudio.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Konverter AutoCAD DWG ke Google Earth KMZ</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Auto-Detect
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Konversi file .dwg otomatis menjadi .kmz lengkap dengan FDT, FAT, Tiang, Kabel &amp; Homepass
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
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-700 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".dwg"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB • Siap Dikonversi</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-cyan-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  Klik atau seret file <span className="text-cyan-400 font-bold">.dwg</span> ke area ini
                </div>
                <p className="text-[11px] text-slate-500">Mendukung format AutoCAD 2004 s/d 2024 (AC1018 - AC1032)</p>
              </div>
            )}
          </div>

          {/* Optional Anchor Coordinates Accordion */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Titik Acuan Koordinat GPS (Opsional / Otomatis Terdeteksi dari Title Block)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Latitude Acuan FDT</label>
                <input
                  type="text"
                  value={anchorLat}
                  onChange={(e) => setAnchorLat(e.target.value)}
                  placeholder="Contoh: 1.148823 atau auto"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Longitude Acuan FDT</label>
                <input
                  type="text"
                  value={anchorLon}
                  onChange={(e) => setAnchorLon(e.target.value)}
                  placeholder="Contoh: 124.810535 atau auto"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Result Card if Converted */}
          {result && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>DWG Berhasil Dikonversi ke Google Earth KMZ!</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  {result.metadata?.clusterCode || 'CLUSTER'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Home className="w-3 h-3 text-emerald-400" /> Homepass
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">{result.stats?.totalHomepasses} HP</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-400" /> FAT
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">{result.stats?.totalFats} FAT</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Navigation className="w-3 h-3 text-amber-400" /> Tiang
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">{result.stats?.totalPoles} Tiang</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1">
                    <Cable className="w-3 h-3 text-purple-400" /> Jalur Kabel
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">
                    {result.projectPreview?.totalCableRouteM ? `${result.projectPreview.totalCableRouteM} m` : `${result.stats?.totalCables} Jalur`}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {result.metadata?.clusterName} • {result.metadata?.anchorLat?.toFixed(6)}°, {result.metadata?.anchorLon?.toFixed(6)}°
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {file ? `File terpilih: ${file.name}` : 'Pilih file .dwg untuk memulai'}
          </div>

          <div className="flex items-center gap-2">
            {!result ? (
              <button
                type="button"
                onClick={() => handleConvert(false)}
                disabled={!file || converting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {converting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengonversi DWG...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Mulai Konversi ke KMZ</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDownloadKmz}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Download File KMZ</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenInStudio}
                  disabled={converting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuka di Studio...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Buka Langsung di GeoStudio</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
