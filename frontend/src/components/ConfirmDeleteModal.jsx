import React, { useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  FolderKanban,
  Home,
  Radio,
  Cable,
  User,
  ShieldAlert,
  FileSpreadsheet,
  MapPin
} from 'lucide-react';

/**
 * Reusable Professional Confirmation Modal for Delete & Destructive Actions
 * Supports:
 * - type: 'PROJECT' (Cluster KMZ) | 'USER' (Drafter / User Account) | 'GENERIC'
 */
export default function ConfirmDeleteModal({
  isOpen,
  type = 'PROJECT',
  title,
  subtitle,
  item,
  confirmText = 'Ya, Hapus Permanen',
  cancelText = 'Batal',
  loading = false,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen || !item) return null;

  const isProject = type === 'PROJECT';
  const isUser = type === 'USER';

  const modalTitle =
    title ||
    (isProject
      ? 'Konfirmasi Hapus Cluster KMZ'
      : isUser
      ? 'Konfirmasi Hapus Akun Pengguna'
      : 'Konfirmasi Penghapusan Data');

  const modalSubtitle =
    subtitle ||
    (isProject
      ? 'Data topologi, spreadsheet HPDB, dan kalkulasi BoQ cluster ini akan dihapus permanen'
      : isUser
      ? 'Akun pengguna beserta seluruh riwayat cluster miliknya akan dihapus dari sistem'
      : 'Tindakan ini bersifat permanen dan tidak dapat dibatalkan');

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn"
      onClick={() => {
        if (!loading) onCancel?.();
      }}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl shadow-red-950/40 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Danger Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/90 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/25 to-rose-600/15 border border-red-500/40 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <span className=" -top-1 -right-1 absolute w-4 h-4 rounded-full bg-red-500 border-2 border-slate-950 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-red-500/15 text-red-300 border border-red-500/30">
                  Tindakan Permanen
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white tracking-tight mt-1">
                {modalTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{modalSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition disabled:opacity-40"
            title="Tutup Modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* TARGET DETAILS CARD: PROJECT / CLUSTER */}
          {isProject && (
            <div className="p-4 rounded-2xl bg-slate-950/95 border border-slate-800 space-y-3.5 shadow-inner">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {item.clusterCode || 'CLUSTER'}
                      </span>
                      {item.kmzFileName && (
                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[220px]">
                          {item.kmzFileName}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold text-white mt-1 break-words">
                      {item.clusterName}
                    </div>
                    {(item.regencyCity || item.province) && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">
                          {[item.subdistrict, item.regencyCity, item.province]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cluster Topology Metrics Summary */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/90">
                  <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <Home className="w-3 h-3 text-emerald-400" />
                    <span>Homepass</span>
                  </div>
                  <div className="text-xs font-extrabold text-emerald-400 mt-0.5">
                    {(item.totalHomepass || 0).toLocaleString()} HP
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/90">
                  <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>FDT / FAT</span>
                  </div>
                  <div className="text-xs font-extrabold text-cyan-300 mt-0.5">
                    {item.totalFdt || 0} FDT • {item.totalFat || 0} FAT
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/90">
                  <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <Cable className="w-3 h-3 text-amber-400" />
                    <span>Kabel FO</span>
                  </div>
                  <div className="text-xs font-extrabold text-amber-400 mt-0.5">
                    {(item.totalCableLengthM || 0).toLocaleString()} m
                  </div>
                </div>
              </div>

              {item.createdBy && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>Dikonversi oleh Drafter:</span>
                  <span className="font-bold text-slate-200">
                    {item.createdBy.fullName}{' '}
                    <span className="text-cyan-400 font-mono">@{item.createdBy.username}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TARGET DETAILS CARD: USER ACCOUNT */}
          {isUser && (
            <div className="p-4 rounded-2xl bg-slate-950/95 border border-slate-800 space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-extrabold text-base shrink-0">
                    {(item.fullName || item.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white truncate">
                        {item.fullName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {item.role || 'DRAFTER'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate mt-0.5">
                      @{item.username} • {item.email}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/90">
                  <div className="text-[10px] text-slate-400">Departemen &amp; Area</div>
                  <div className="font-bold text-slate-200 mt-0.5 truncate">
                    {item.department || 'SND FTTH'} • {item.region || '-'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/90">
                  <div className="text-[10px] text-slate-400">Cluster Tersimpan</div>
                  <div className="font-extrabold text-amber-400 mt-0.5">
                    {item._count?.projects ?? item.projects?.length ?? 0} Cluster KMZ
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warning Alert Box */}
          <div className="p-3.5 rounded-2xl bg-red-950/35 border border-red-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200/90 leading-relaxed">
              <span className="font-extrabold text-red-300 block mb-0.5">
                Peringatan Penghapusan Permanen
              </span>
              {isProject ? (
                <>
                  Seluruh data ekstraksi{' '}
                  <strong className="text-white">58 kolom HPDB</strong>, kalkulasi material{' '}
                  <strong className="text-white">BoQ &amp; BoM AE</strong>, serta titik koordinat
                  peta GIS untuk cluster <strong className="text-white">&ldquo;{item.clusterName}&rdquo;</strong>{' '}
                  akan dihapus dan tidak dapat dikembalikan.
                </>
              ) : isUser ? (
                <>
                  Menghapus akun <strong className="text-white">{item.fullName}</strong> juga akan
                  menghapus secara otomatis seluruh{' '}
                  <strong className="text-white">
                    {item._count?.projects ?? item.projects?.length ?? 0} cluster KMZ
                  </strong>{' '}
                  yang pernah dikonversi oleh pengguna ini.
                </>
              ) : (
                <>Data yang telah dihapus tidak dapat dipulihkan kembali ke dalam sistem.</>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/95 border-t border-slate-800/90 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-lg shadow-red-600/25 border border-red-400/30 transition disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghapus Data...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
