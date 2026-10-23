import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Globe,
  UploadCloud,
  FileSpreadsheet,
  Map as MapIcon,
  ShieldCheck,
  LogOut,
  Settings2,
  Trash2,
  Download,
  Plus,
  CheckCircle2,
  Layers,
  Home,
  Radio,
  Cable,
  Sparkles,
  FolderKanban,
  FileDown,
  AlertCircle,
  Search,
  Zap,
  User,
  Users,
  Eye,
  ArrowRight,
  Lock,
  Calendar,
  ChevronRight,
  Loader2,
  X,
  Crown,
  QrCode,
  FileCode2
} from 'lucide-react';
import {
  apiFetch,
  downloadExcelFile,
  downloadBinaryFile,
  getToken,
  setToken
} from './api';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import HpdbExcelPreview from './components/HpdbExcelPreview';
import BoqExcelPreview from './components/BoqExcelPreview';
import TopologyMap from './components/TopologyMap';
import ProjectEditorModal from './components/ProjectEditorModal';
import AdminDashboard from './components/AdminDashboard';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import DwgConverterModal from './components/DwgConverterModal';
import KmzToDwgModal from './components/KmzToDwgModal';
import DanaPaymentModal from './components/DanaPaymentModal';

function getPageFromHash() {
  const h = window.location.hash.replace('#', '').toLowerCase();
  if (h === '/login' || h === 'login') return 'login';
  if (h === '/register' || h === 'register') return 'register';
  return 'landing';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [publicPage, setPublicPage] = useState(getPageFromHash); // 'landing' | 'login' | 'register'
  const [loginBannerMessage, setLoginBannerMessage] = useState('');

  // Sidebar navigation state:
  // 'CONVERT' | 'CLUSTERS' | 'HPDB' | 'BOQ' | 'MAP' | 'ADMIN'
  const [activeMenu, setActiveMenu] = useState('CLUSTERS');

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);

  // Filter & Pagination in Cluster List view
  const [clusterSearch, setClusterSearch] = useState('');
  const [adminUserFilter, setAdminUserFilter] = useState('ALL');
  const [clusterPage, setClusterPage] = useState(1);
  const [clusterPageSize, setClusterPageSize] = useState(5);

  // Convert KMZ studio state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAdvancedOverrides, setShowAdvancedOverrides] = useState(false);
  const [overrides, setOverrides] = useState({
    clusterCode: '',
    clusterName: '',
    region: '',
    province: '',
    regencyCity: '',
    district: '',
    subdistrict: '',
    postalCode: '',
    oltName: '',
    feederCode: '',
    street: ''
  });
  const [lastConvertedProject, setLastConvertedProject] = useState(null);
  const [convertModal, setConvertModal] = useState({
    isOpen: false,
    status: 'IDLE', // 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'
    fileName: '',
    fileSizeKb: '0',
    progress: 0,
    stepIndex: 0,
    errorMsg: '',
    resultProject: null
  });
  const fileInputRef = useRef(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [exportingHpdb, setExportingHpdb] = useState(false);
  const [exportingBoq, setExportingBoq] = useState(false);
  const [exportingClusterKey, setExportingClusterKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeDefaultPlan, setUpgradeDefaultPlan] = useState('PRO');
  const [dwgModalOpen, setDwgModalOpen] = useState(false);
  const [kmzToDwgModalOpen, setKmzToDwgModalOpen] = useState(false);
  const [exportingDwg, setExportingDwg] = useState(false);
  const [exportingDxf, setExportingDxf] = useState(false);

  const isBoqAllowed = user?.role === 'ADMIN' || Boolean(user?.boqAccessAllowed);
  const isUnlimitedQuota = user?.role === 'ADMIN' || user?.monthlyConvertLimit === -1;
  const openUpgradeModal = (planCode = 'PRO') => {
    setUpgradeDefaultPlan(planCode);
    setUpgradeModalOpen(true);
  };

  const navigatePublic = (page) => {
    setPublicPage(page);
    if (page === 'login') {
      window.location.hash = '#/login';
    } else if (page === 'register') {
      window.location.hash = '#/register';
    } else {
      window.location.hash = '#/';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onHashChange = () => {
      setPublicPage(getPageFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Verify token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    apiFetch('/auth/me')
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  // Load projects list (automatically scoped to user on backend; Admin gets all)
  const fetchProjects = async (selectId = null) => {
    if (!user) return;
    try {
      const data = await apiFetch('/projects');
      const list = data.projects || [];
      setProjects(list);
      const targetId = selectId || activeProjectId || (list[0] && list[0].id);
      if (targetId && list.some((p) => p.id === targetId)) {
        setActiveProjectId(targetId);
      } else if (list[0]) {
        setActiveProjectId(list[0].id);
      } else {
        setActiveProjectId(null);
        setActiveProject(null);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  // Load full project details when activeProjectId changes
  useEffect(() => {
    if (!user || !activeProjectId) return;
    let mounted = true;
    setLoadingProject(true);
    apiFetch(`/projects/${activeProjectId}`)
      .then((data) => {
        if (mounted && data?.project) {
          setActiveProject(data.project);
        }
      })
      .catch((err) => {
        console.error('Error loading project details:', err);
      })
      .finally(() => {
        if (mounted) setLoadingProject(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeProjectId, user]);

  // Unique users who have projects (for Admin filter in Cluster List)
  const projectOwners = useMemo(() => {
    const map = new Map();
    for (const p of projects) {
      if (p.createdBy && !map.has(p.createdBy.id)) {
        map.set(p.createdBy.id, {
          ...p.createdBy,
          count: projects.filter((x) => x.createdBy?.id === p.createdBy.id).length
        });
      }
    }
    return Array.from(map.values());
  }, [projects]);

  // Filtered projects for the Cluster List page
  const filteredProjects = useMemo(() => {
    const q = clusterSearch.trim().toLowerCase();
    return projects.filter((p) => {
      if (user?.role === 'ADMIN' && adminUserFilter !== 'ALL') {
        if (p.createdBy?.id !== adminUserFilter) return false;
      }
      if (!q) return true;
      return (
        p.clusterName.toLowerCase().includes(q) ||
        p.clusterCode.toLowerCase().includes(q) ||
        (p.kmzFileName || '').toLowerCase().includes(q) ||
        (p.regencyCity || '').toLowerCase().includes(q) ||
        (p.createdBy?.fullName || '').toLowerCase().includes(q) ||
        (p.createdBy?.username || '').toLowerCase().includes(q)
      );
    });
  }, [projects, clusterSearch, adminUserFilter, user]);

  const totalClusterPages = Math.max(1, Math.ceil(filteredProjects.length / clusterPageSize));
  const safeClusterPage = Math.min(clusterPage, totalClusterPages);

  useEffect(() => {
    setClusterPage(1);
  }, [clusterSearch, adminUserFilter, clusterPageSize]);

  const paginatedProjects = useMemo(() => {
    const startIdx = (safeClusterPage - 1) * clusterPageSize;
    return filteredProjects.slice(startIdx, startIdx + clusterPageSize);
  }, [filteredProjects, safeClusterPage, clusterPageSize]);

  // Aggregate KPI totals for displayed clusters
  const clusterStats = useMemo(() => {
    return filteredProjects.reduce(
      (acc, p) => {
        acc.totalClusters += 1;
        acc.totalHp += p.totalHomepass || 0;
        acc.totalFat += p.totalFat || 0;
        acc.totalFdt += p.totalFdt || 0;
        acc.totalCableM += p.totalCableLengthM || 0;
        acc.totalPoles += p.totalPoles || 0;
        return acc;
      },
      { totalClusters: 0, totalHp: 0, totalFat: 0, totalFdt: 0, totalCableM: 0, totalPoles: 0 }
    );
  }, [filteredProjects]);

  const handleUploadKmz = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Silakan pilih file .kmz, .kml, atau .dwg terlebih dahulu.');
      return;
    }
    const currentFile = selectedFile;
    setUploading(true);
    setUploadError('');
    setConvertModal({
      isOpen: true,
      status: 'PROCESSING',
      fileName: currentFile.name,
      fileSizeKb: (currentFile.size / 1024).toFixed(1),
      progress: 14,
      stepIndex: 0,
      errorMsg: '',
      resultProject: null
    });

    const timers = [
      setTimeout(() => {
        setConvertModal((prev) =>
          prev.status === 'PROCESSING' ? { ...prev, progress: 42, stepIndex: 1 } : prev
        );
      }, 550),
      setTimeout(() => {
        setConvertModal((prev) =>
          prev.status === 'PROCESSING' ? { ...prev, progress: 72, stepIndex: 2 } : prev
        );
      }, 1150),
      setTimeout(() => {
        setConvertModal((prev) =>
          prev.status === 'PROCESSING' ? { ...prev, progress: 92, stepIndex: 3 } : prev
        );
      }, 1700)
    ];

    try {
      const formData = new FormData();
      formData.append('kmzFile', currentFile);
      Object.entries(overrides).forEach(([k, v]) => {
        if (v && String(v).trim() !== '') {
          formData.append(k, String(v).trim());
        }
      });

      const minVisualDelay = new Promise((resolve) => setTimeout(resolve, 2250));
      const [data] = await Promise.all([
        apiFetch('/projects/upload', {
          method: 'POST',
          body: formData
        }),
        minVisualDelay
      ]);

      timers.forEach(clearTimeout);
      setSelectedFile(null);
      if (data?.user) {
        setUser(data.user);
      }
      setLastConvertedProject(data.project);
      await fetchProjects(data.project.id);
      setActiveProject(data.project);
      setConvertModal((prev) => ({
        ...prev,
        status: 'SUCCESS',
        progress: 100,
        stepIndex: 4,
        resultProject: data.project
      }));
      showToast(
        `Berhasil mengekstrak "${data.project.clusterName}" (${data.project.totalHomepass} HP, ${data.project.totalFat} FAT, ${data.project.totalFdt} FDT)!`
      );
    } catch (err) {
      timers.forEach(clearTimeout);
      setUploadError(err.message);
      setConvertModal((prev) => ({
        ...prev,
        status: 'ERROR',
        errorMsg: err.message || 'Gagal mengekstrak file KMZ/KML.'
      }));
      if (err.code === 'QUOTA_EXCEEDED' || err.code === 'SUBSCRIPTION_INACTIVE') {
        showToast(err.message, 'error');
        setConvertModal((prev) => ({ ...prev, isOpen: false }));
        openUpgradeModal(user?.subscriptionPlan === 'BASIC' ? 'PRO' : 'ULTRA');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadHpdb = async (targetProj = activeProject) => {
    if (!targetProj) return;
    setExportingHpdb(true);
    setExportingClusterKey(`${targetProj.id}-hpdb`);
    try {
      const safeName = `HPDB - ${targetProj.clusterCode} - ${targetProj.clusterName}.xlsx`;
      await downloadExcelFile(`/projects/${targetProj.id}/export/hpdb`, safeName);
      showToast(`File Excel HPDB (${safeName}) berhasil diunduh!`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExportingHpdb(false);
      setExportingClusterKey(null);
    }
  };

  const handleDownloadBoq = async (targetProj = activeProject) => {
    if (!targetProj) return;
    if (!isBoqAllowed) {
      showToast(
        'Fitur Export & Tabel BoQ tidak termasuk dalam Paket BASIC. Silakan upgrade ke Paket PRO atau ULTRA!',
        'error'
      );
      openUpgradeModal('PRO');
      return;
    }
    setExportingBoq(true);
    setExportingClusterKey(`${targetProj.id}-boq`);
    try {
      const safeName = `BOQ - ${targetProj.clusterCode} - ${targetProj.clusterName}.xlsx`;
      await downloadExcelFile(`/projects/${targetProj.id}/export/boq`, safeName);
      showToast(`File Excel BoQ (${safeName}) berhasil diunduh!`);
    } catch (err) {
      showToast(err.message, 'error');
      if (err.code === 'BOQ_NOT_INCLUDED') {
        openUpgradeModal('PRO');
      }
    } finally {
      setExportingBoq(false);
      setExportingClusterKey(null);
    }
  };

  const handleDownloadDwg = async (targetProj = activeProject) => {
    if (!targetProj) return;
    setExportingDwg(true);
    setExportingClusterKey(`${targetProj.id}-dwg`);
    try {
      const safeName = `${targetProj.clusterCode || 'CLUSTER'} - ${targetProj.clusterName || 'FTTH'} - AS PLAN.dwg`;
      await downloadBinaryFile(`/projects/${targetProj.id}/export/dwg`, safeName);
      showToast(`Gambar AutoCAD DWG (${safeName}) berhasil diekspor!`);
    } catch (err) {
      showToast(err.message || 'Gagal mengekspor file AutoCAD DWG.', 'error');
    } finally {
      setExportingDwg(false);
      setExportingClusterKey(null);
    }
  };

  const handleDownloadDxf = async (targetProj = activeProject) => {
    if (!targetProj) return;
    setExportingDxf(true);
    setExportingClusterKey(`${targetProj.id}-dxf`);
    try {
      const safeName = `${targetProj.clusterCode || 'CLUSTER'} - ${targetProj.clusterName || 'FTTH'} - AS PLAN.dxf`;
      await downloadBinaryFile(`/projects/${targetProj.id}/export/dxf`, safeName);
      showToast(`File AutoCAD DXF (${safeName}) berhasil diekspor!`);
    } catch (err) {
      showToast(err.message || 'Gagal mengekspor file AutoCAD DXF.', 'error');
    } finally {
      setExportingDxf(false);
      setExportingClusterKey(null);
    }
  };

  const handleDownloadSampleKmz = async () => {
    try {
      await downloadExcelFile('/sample-kmz', 'CONTOH KMZ.kmz');
      showToast('File referensi CONTOH KMZ.kmz berhasil diunduh!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProject = (proj) => {
    if (!proj) return;
    setDeleteProjectTarget(proj);
  };

  const handleConfirmDeleteProject = async () => {
    if (!deleteProjectTarget) return;
    setDeletingProject(true);
    try {
      await apiFetch(`/projects/${deleteProjectTarget.id}`, { method: 'DELETE' });
      const deletedName = deleteProjectTarget.clusterName;
      const deletedId = deleteProjectTarget.id;
      setDeleteProjectTarget(null);
      const remaining = projects.filter((p) => p.id !== deletedId);
      setProjects(remaining);
      if (activeProjectId === deletedId) {
        setActiveProjectId(remaining[0]?.id || null);
        if (!remaining.length) {
          setActiveProject(null);
          if (['HPDB', 'BOQ', 'MAP'].includes(activeMenu)) {
            setActiveMenu('CLUSTERS');
          }
        }
      }
      if (lastConvertedProject?.id === deletedId) {
        setLastConvertedProject(null);
      }
      showToast(`Cluster "${deletedName}" telah dihapus secara permanen.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingProject(false);
    }
  };

  const openClusterInView = (projectId, viewTab = 'HPDB') => {
    if (viewTab === 'BOQ' && !isBoqAllowed) {
      showToast(
        'Akses Tabel BoQ hanya tersedia pada Paket PRO & ULTRA. Silakan upgrade paket Anda!',
        'error'
      );
      openUpgradeModal('PRO');
      return;
    }
    setActiveProjectId(projectId);
    setActiveMenu(viewTab);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setProjects([]);
    setActiveProject(null);
    setActiveProjectId(null);
    setLastConvertedProject(null);
    navigatePublic('landing');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#040812] flex items-center justify-center text-slate-300 text-sm">
        Memuat sesi autentikasi FTTH SND GeoStudio...
      </div>
    );
  }

  // Public Unauthenticated Routes: Separate Landing Page, Login Page, and Register Page
  if (!user) {
    if (publicPage === 'login') {
      return (
        <LoginPage
          initialMessage={loginBannerMessage}
          onLoginSuccess={(u) => {
            setLoginBannerMessage('');
            setUser(u);
            setActiveMenu('CLUSTERS');
            window.location.hash = '';
          }}
          onNavigateLanding={() => {
            setLoginBannerMessage('');
            navigatePublic('landing');
          }}
          onNavigateRegister={() => {
            setLoginBannerMessage('');
            navigatePublic('register');
          }}
        />
      );
    }

    if (publicPage === 'register') {
      return (
        <RegisterPage
          onNavigateLanding={() => navigatePublic('landing')}
          onNavigateLogin={(msg) => {
            if (msg) setLoginBannerMessage(msg);
            navigatePublic('login');
          }}
          onLoginSuccess={(u) => {
            setLoginBannerMessage('');
            setUser(u);
            setActiveMenu('CLUSTERS');
            window.location.hash = '';
          }}
        />
      );
    }

    return (
      <LandingPage
        onNavigateLogin={() => navigatePublic('login')}
        onNavigateRegister={() => navigatePublic('register')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050914] text-slate-100 flex">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold transition-all ${
            toast.type === 'error'
              ? 'bg-red-950/95 border-red-500/40 text-red-200'
              : 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* =====================================================================
          FIXED LEFT SIDEBAR (DRAFTER & ADMIN NAVIGATION)
          ===================================================================== */}
      <aside className="w-72 shrink-0 bg-slate-950 border-r border-slate-800/90 flex flex-col justify-between sticky top-0 h-screen overflow-y-auto select-none">
        <div className="p-4 space-y-5">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-12 h-12 p-1 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/90 shrink-0">
              <img
                src="/logo-icon.png"
                alt="FTTH SND GeoStudio Emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>
                  FTTH SND <span className="text-cyan-400">Geo</span>
                  <span className="text-[#d6b772]">Studio</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-1.5 py-0.2 rounded bg-[#081c37] border border-[#d6b772]/40 text-[#d6b772] text-[9px] font-bold">
                  by TOSKA
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  KMZ Studio
                </span>
              </div>
            </div>
          </div>

          {/* Active User Card & Subscription Quota */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-extrabold text-sm shrink-0">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-white truncate">{user.fullName}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  @{user.username} • {user.region || 'SND FTTH'}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
              <span
                className={`px-2 py-0.5 rounded font-extrabold ${
                  user.role === 'ADMIN'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : user.subscriptionPlan === 'ULTRA'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : user.subscriptionPlan === 'PRO'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {user.role === 'ADMIN'
                  ? 'ADMIN MASTER'
                  : `PAKET ${user.subscriptionPlan || 'BASIC'}`}
              </span>
              <span className="text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                {user.role === 'ADMIN'
                  ? 'Full Akses'
                  : isBoqAllowed
                  ? 'HPDB + BoQ Aktif'
                  : 'HPDB Only (No BoQ)'}
              </span>
            </div>

            {user.role !== 'ADMIN' && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-semibold">Kuota Convert Bulan Ini:</span>
                  <span className="font-mono font-extrabold text-cyan-300">
                    {isUnlimitedQuota
                      ? `${user.monthlyConvertUsed || 0} / ∞ Unlimited`
                      : `${user.monthlyConvertUsed || 0} / ${user.monthlyConvertLimit || 10}x`}
                  </span>
                </div>
                {!isUnlimitedQuota && (
                  <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (user.monthlyConvertUsed || 0) >= (user.monthlyConvertLimit || 10)
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((user.monthlyConvertUsed || 0) /
                              Math.max(1, user.monthlyConvertLimit || 10)) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    openUpgradeModal(user.subscriptionPlan === 'BASIC' ? 'PRO' : 'ULTRA')
                  }
                  className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-[#118EEA]/25 to-cyan-500/20 hover:from-[#118EEA]/40 hover:to-cyan-500/35 border border-[#118EEA]/40 text-cyan-200 font-extrabold text-[10px] flex items-center justify-center gap-1.5 transition"
                >
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Upgrade / Perpanjang Paket (DANA)</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Menu: Convert KMZ & List Cluster */}
          <div className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Menu Utama Drafter
            </div>

            <button
              onClick={() => setActiveMenu('CONVERT')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeMenu === 'CONVERT'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <UploadCloud className="w-4 h-4" />
                <span>Convert KMZ Baru</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/15 text-white">
                + Upload
              </span>
            </button>

            <button
              type="button"
              onClick={() => setKmzToDwgModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 group cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <FileCode2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Convert KMZ ke DWG</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> CAD
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDwgModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 group cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <FileCode2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Convert DWG ke KMZ</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-extrabold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Auto
              </span>
            </button>

            <button
              onClick={() => setActiveMenu('CLUSTERS')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeMenu === 'CLUSTERS'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FolderKanban className="w-4 h-4" />
                <span>
                  {user.role === 'ADMIN' ? 'List Semua Cluster' : 'List Cluster Saya'}
                </span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeMenu === 'CLUSTERS'
                    ? 'bg-white text-blue-700'
                    : 'bg-slate-800 text-cyan-300'
                }`}
              >
                {projects.length}
              </span>
            </button>
          </div>

          {/* Active Cluster Views Submenu */}
          {activeProject && (
            <div className="space-y-1 pt-2 border-t border-slate-800/80">
              <div className="px-2.5 pb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Cluster Aktif</span>
                <span className="text-cyan-400 font-mono">{activeProject.clusterCode}</span>
              </div>

              <button
                onClick={() => setActiveMenu('HPDB')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeMenu === 'HPDB'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Tabel Excel HPDB</span>
              </button>

              <button
                onClick={() => {
                  if (!isBoqAllowed) {
                    showToast(
                      'Tabel BoQ tidak termasuk dalam Paket BASIC. Silakan upgrade ke Paket PRO atau ULTRA!',
                      'error'
                    );
                    openUpgradeModal('PRO');
                    return;
                  }
                  setActiveMenu('BOQ');
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeMenu === 'BOQ'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Tabel Excel BoQ &amp; BoM</span>
                </span>
                {!isBoqAllowed && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold border border-amber-500/30">
                    🔒 PRO
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveMenu('MAP')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeMenu === 'MAP'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                <span>Peta Topologi KMZ</span>
              </button>
            </div>
          )}

          {/* Admin Menu */}
          {user.role === 'ADMIN' && (
            <div className="space-y-1 pt-2 border-t border-slate-800/80">
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                Menu Administrator
              </div>
              <button
                onClick={() => setActiveMenu('ADMIN')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeMenu === 'ADMIN'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/25'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Cluster Per-User &amp; Approval</span>
              </button>
            </div>
          )}

          {/* Quick List of User's Converted Clusters in Sidebar */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="px-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Riwayat Cluster ({projects.length})</span>
              <button
                onClick={() => setActiveMenu('CONVERT')}
                className="text-cyan-400 hover:text-cyan-300"
              >
                + Baru
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {projects.map((p) => {
                const isSel =
                  p.id === activeProjectId &&
                  ['HPDB', 'BOQ', 'MAP'].includes(activeMenu);
                return (
                  <div
                    key={p.id}
                    onClick={() => openClusterInView(p.id, 'HPDB')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openClusterInView(p.id, 'HPDB');
                    }}
                    className={`group w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSel
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold truncate">{p.clusterName}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-cyan-400">{p.clusterCode}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{p.totalHomepass} HP</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(p);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 transition"
                        title="Hapus Cluster"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    </div>
                  </div>
                );
              })}
              {projects.length === 0 && (
                <div className="px-2.5 py-4 text-center text-[11px] text-slate-500">
                  Belum ada cluster yang Anda convert.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Sidebar Actions & Copyright */}
        <div className="p-4 border-t border-slate-800/90 bg-slate-950/90 space-y-2.5">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-bold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sesi (Logout)</span>
          </button>

          <div className="text-center text-[10px] text-slate-500 pt-1">
            copyright TOSKA @ 2026 - design by Ndoo-
          </div>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT MAIN CONTENT AREA
          ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-20 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-extrabold text-white flex items-center gap-2">
              {activeMenu === 'CONVERT' && (
                <>
                  <UploadCloud className="w-5 h-5 text-cyan-400" />
                  <span>Convert File Desain KMZ / KML Baru</span>
                </>
              )}
              {activeMenu === 'CLUSTERS' && (
                <>
                  <FolderKanban className="w-5 h-5 text-cyan-400" />
                  <span>
                    {user.role === 'ADMIN'
                      ? 'Daftar Cluster Hasil Convert (Semua Drafter / Per-User)'
                      : `Daftar Cluster Hasil Convert Saya (${user.fullName})`}
                  </span>
                </>
              )}
              {['HPDB', 'BOQ', 'MAP'].includes(activeMenu) && activeProject && (
                <>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs">
                    {activeProject.clusterCode}
                  </span>
                  <span>{activeProject.clusterName}</span>
                </>
              )}
              {activeMenu === 'ADMIN' && (
                <>
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <span>Panel Administrator — Monitoring Cluster Per-User &amp; Approval</span>
                </>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {user.role === 'ADMIN'
                ? 'Mode Administrator: Anda dapat memantau seluruh cluster yang dikonversi oleh setiap Drafter'
                : 'Workspace Pribadi Drafter: Hanya menampilkan cluster KMZ yang Anda konversi sendiri'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeMenu !== 'CONVERT' && (
              <button
                onClick={() => setActiveMenu('CONVERT')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Convert KMZ Baru</span>
              </button>
            )}
            {activeMenu !== 'CLUSTERS' && (
              <button
                onClick={() => setActiveMenu('CLUSTERS')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs transition"
              >
                <FolderKanban className="w-4 h-4 text-cyan-400" />
                <span>List Cluster ({projects.length})</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-6 space-y-6 max-w-[1500px] w-full mx-auto">
          {/* =================================================================
              VIEW 1: CONVERT KMZ BARU (DEDICATED CONVERTER STUDIO)
              ================================================================= */}
          {activeMenu === 'CONVERT' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-white">
                        1-Click AutoCAD DWG / Google Earth KMZ Converter
                      </h2>
                      <p className="text-xs text-slate-400">
                        Unggah file <code className="text-cyan-300">.kmz</code>, <code className="text-cyan-300">.kml</code>, atau AutoCAD <code className="text-cyan-300">.dwg</code> Anda untuk langsung dikonversi ke Excel{' '}
                        <strong className="text-emerald-400">HPDB.xlsx</strong> &amp;{' '}
                        <strong className="text-amber-400">BOQ.xlsx</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* DWG to KMZ Quick Action Banner */}
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <FileCode2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Punya file desain AutoCAD DWG (.dwg)?</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-extrabold">BARU</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Konversi langsung .dwg menjadi file .kmz untuk Google Earth atau buka langsung di GeoStudio
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDwgModalOpen(true)}
                    className="shrink-0 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buka Tool Konversi DWG</span>
                  </button>
                </div>

                <form onSubmit={handleUploadKmz} className="space-y-5">
                  {uploadError && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Drag & Drop Zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
                      selectedFile
                        ? 'border-emerald-500/60 bg-emerald-950/15'
                        : 'border-slate-700 hover:border-cyan-500/60 bg-slate-950/70'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".kmz,.kml,.dwg"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <UploadCloud
                      className={`w-14 h-14 mx-auto mb-3 ${
                        selectedFile ? 'text-emerald-400' : 'text-cyan-400'
                      }`}
                    />
                    {selectedFile ? (
                      <div className="space-y-1">
                        <div className="text-base font-extrabold text-emerald-400">
                          {selectedFile.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          Ukuran File: {(selectedFile.size / 1024).toFixed(1)} KB • Klik untuk mengganti file
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-sm font-extrabold text-white">
                          Klik di sini untuk memilih file desain{' '}
                          <span className="text-cyan-400">.KMZ</span>,{' '}
                          <span className="text-cyan-400">.KML</span>, atau{' '}
                          <span className="text-cyan-400">.DWG</span>
                        </div>
                        <p className="text-xs text-slate-400 max-w-lg mx-auto">
                          Sistem otomatis mengekstrak FDT, Line A/B/C/D, FAT, Snapping Pole ID terdekat, Homepass (HP Cover), panjang kabel FO (24C/2T, 36C/3T, 48C/4T), dan Sling Wire.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Optional Administrative Overrides Accordion */}
                  <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedOverrides(!showAdvancedOverrides)}
                      className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-cyan-400" />
                        <span>
                          Parameter Wilayah &amp; OLT Opsional (Kosongkan untuk deteksi otomatis dari KMZ)
                        </span>
                      </span>
                      <span className="text-cyan-400">
                        {showAdvancedOverrides ? 'Sembunyikan ▲' : 'Tampilkan ▼'}
                      </span>
                    </button>

                    {showAdvancedOverrides && (
                      <div className="p-4 pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-400 mb-1">Cluster Code</label>
                          <input
                            type="text"
                            placeholder="Otomatis dari KMZ"
                            value={overrides.clusterCode}
                            onChange={(e) =>
                              setOverrides({ ...overrides, clusterCode: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-400 mb-1">Cluster Name</label>
                          <input
                            type="text"
                            placeholder="Otomatis dari KMZ"
                            value={overrides.clusterName}
                            onChange={(e) =>
                              setOverrides({ ...overrides, clusterName: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Province</label>
                          <input
                            type="text"
                            placeholder="Contoh: SULAWESI UTARA"
                            value={overrides.province}
                            onChange={(e) =>
                              setOverrides({ ...overrides, province: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Regency / City</label>
                          <input
                            type="text"
                            placeholder="Contoh: KOTAMOBAGU"
                            value={overrides.regencyCity}
                            onChange={(e) =>
                              setOverrides({ ...overrides, regencyCity: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">District / Kecamatan</label>
                          <input
                            type="text"
                            placeholder="Contoh: KOTAMOBAGU SELATAN"
                            value={overrides.district}
                            onChange={(e) =>
                              setOverrides({ ...overrides, district: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Subdistrict / Kelurahan</label>
                          <input
                            type="text"
                            placeholder="Contoh: POYOWA BESAR SATU"
                            value={overrides.subdistrict}
                            onChange={(e) =>
                              setOverrides({ ...overrides, subdistrict: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Postal Code</label>
                          <input
                            type="text"
                            placeholder="Contoh: 95717"
                            value={overrides.postalCode}
                            onChange={(e) =>
                              setOverrides({ ...overrides, postalCode: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Street / Nama Jalan</label>
                          <input
                            type="text"
                            placeholder="Contoh: POYOWA BESAR SATU"
                            value={overrides.street}
                            onChange={(e) =>
                              setOverrides({ ...overrides, street: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={uploading || !selectedFile}
                      className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold shadow-xl shadow-cyan-500/25 transition disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      <span>
                        {uploading
                          ? 'Mengekstrak KMZ & Menyusun Excel...'
                          : 'Convert KMZ ke HPDB & BoQ Sekarang'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Instant Conversion Result Card */}
              {lastConvertedProject && (
                <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                          Konversi KMZ Berhasil Disimpan ke Daftar Cluster Anda
                        </span>
                        <h3 className="text-base font-extrabold text-white">
                          {lastConvertedProject.clusterCode} — {lastConvertedProject.clusterName}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => handleDownloadHpdb(lastConvertedProject)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download HPDB.xlsx</span>
                      </button>
                      <button
                        onClick={() => handleDownloadBoq(lastConvertedProject)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download BOQ.xlsx</span>
                      </button>
                      <button
                        onClick={() => openClusterInView(lastConvertedProject.id, 'HPDB')}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Buka Tabel Spreadsheet ➔</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              VIEW 2: LIST CLUSTER HASIL CONVERT (PER DRAFTER / ADMIN FILTER)
              ================================================================= */}
          {activeMenu === 'CLUSTERS' && (
            <div className="space-y-6">
              {/* Top Summary KPI Cards for User's Clusters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Total Cluster Dikonversi</div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {clusterStats.totalClusters} Cluster
                    </div>
                    <div className="text-[11px] text-cyan-400 mt-1">
                      {user.role === 'ADMIN' ? 'Semua Drafter / Sesuai Filter' : `Milik @${user.username}`}
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <FolderKanban className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Total Homepass (HPDB)</div>
                    <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                      {clusterStats.totalHp.toLocaleString()} HP
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Siap Export 58 Kolom (A-BF)</div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Home className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Total FDT &amp; FAT</div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {clusterStats.totalFdt} FDT • {clusterStats.totalFat} FAT
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Auto-Snapped ke Tiang</div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Radio className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Total Kabel FO (24C/36C/48C) &amp; Tiang</div>
                    <div className="text-2xl font-extrabold text-amber-400 mt-1">
                      {clusterStats.totalCableM.toLocaleString()} m
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {clusterStats.totalPoles.toLocaleString()} Total Tiang
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Cable className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Admin Per-User Filter Bar (Only visible to ADMIN) */}
              {user.role === 'ADMIN' && (
                <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">
                      Filter Cluster Berdasarkan Drafter / User:
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setAdminUserFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        adminUserFilter === 'ALL'
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Semua User ({projects.length})
                    </button>
                    {projectOwners.map((owner) => (
                      <button
                        key={owner.id}
                        onClick={() => setAdminUserFilter(owner.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                          adminUserFilter === owner.id
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{owner.fullName}</span>
                        <span className="text-[10px] opacity-75">({owner.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cluster Table Container */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                {/* Table Top Header & Search Toolbar */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-sm font-extrabold text-white tracking-tight">
                          {user.role === 'ADMIN'
                            ? 'Daftar Cluster KMZ yang Telah Dikonversi'
                            : 'Daftar Cluster KMZ yang Telah Anda Konversi'}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                          {filteredProjects.length} Cluster
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Klik tombol <strong className="text-slate-200">HPDB / BoQ / GIS</strong> untuk membuka preview interaktif, atau unduh langsung file <code className="text-cyan-300">.xlsx</code>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={clusterSearch}
                        onChange={(e) => setClusterSearch(e.target.value)}
                        placeholder="Cari kode / nama cluster / file KMZ..."
                        className="pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64 transition"
                      />
                    </div>
                  </div>
                </div>

                {filteredProjects.length === 0 ? (
                  <div className="p-14 text-center space-y-3">
                    <UploadCloud className="w-12 h-12 text-cyan-400 mx-auto" />
                    <div className="text-base font-bold text-white">
                      Belum Ada Cluster KMZ pada Daftar Ini
                    </div>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Silakan gunakan menu <strong>Convert KMZ Baru</strong> di sidebar kiri untuk mengunggah file desain <code className="text-cyan-300">.kmz</code> Anda.
                    </p>
                    <button
                      onClick={() => setActiveMenu('CONVERT')}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs"
                    >
                      Convert KMZ Sekarang
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950/90 text-slate-400 border-b border-slate-800/90 text-[10px] font-bold uppercase tracking-wider">
                            <th className="py-3.5 px-4 w-12 text-center">No</th>
                            <th className="py-3.5 px-4 min-w-[210px]">Kode &amp; Nama Cluster</th>
                            <th className="py-3.5 px-4 min-w-[220px]">File KMZ &amp; Wilayah</th>
                            {user.role === 'ADMIN' && (
                              <th className="py-3.5 px-4 whitespace-nowrap">Drafter</th>
                            )}
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">Homepass</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">Topologi FDT / FAT</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">Kabel FO &amp; Tiang</th>
                            <th className="py-3.5 px-4 whitespace-nowrap">Waktu Convert</th>
                            <th className="py-3.5 px-5 text-right whitespace-nowrap">
                              Preview &amp; Export Excel
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {paginatedProjects.map((p, idx) => {
                            const rowNum = (safeClusterPage - 1) * clusterPageSize + idx + 1;
                            const isCurrentActive = activeProjectId === p.id;
                            const createdDate = new Date(p.createdAt);
                            const dateStr = createdDate.toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            });
                            const timeStr = createdDate.toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            });

                            return (
                              <tr
                                key={p.id}
                                className={`transition-colors ${
                                  isCurrentActive
                                    ? 'bg-cyan-950/15 hover:bg-cyan-950/25'
                                    : 'hover:bg-slate-800/40'
                                }`}
                              >
                                {/* No */}
                                <td className="py-4 px-4 text-center align-middle">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-slate-400">
                                    {rowNum}
                                  </span>
                                </td>

                                {/* Kode & Nama Cluster */}
                                <td className="py-4 px-4 align-middle">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                                      {p.clusterCode}
                                    </span>
                                    {isCurrentActive && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                        Aktif
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-extrabold text-white text-xs mt-1.5 leading-snug">
                                    {p.clusterName}
                                  </div>
                                </td>

                                {/* File KMZ & Wilayah */}
                                <td className="py-4 px-4 align-middle">
                                  <div
                                    className="font-mono text-[11px] text-slate-200 font-medium truncate max-w-[240px]"
                                    title={p.kmzFileName}
                                  >
                                    {p.kmzFileName}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-1 truncate max-w-[240px]">
                                    {p.subdistrict}, {p.regencyCity} ({p.province})
                                  </div>
                                </td>

                                {/* Drafter (Admin Only) */}
                                {user.role === 'ADMIN' && (
                                  <td className="py-4 px-4 align-middle whitespace-nowrap">
                                    <div className="font-bold text-cyan-300 text-xs">
                                      {p.createdBy?.fullName || 'Drafter'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      @{p.createdBy?.username} • {p.createdBy?.department || 'SND'}
                                    </div>
                                  </td>
                                )}

                                {/* Homepass Badge (Single Line No-Wrap) */}
                                <td className="py-4 px-4 text-center align-middle whitespace-nowrap">
                                  <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-extrabold text-xs whitespace-nowrap shadow-sm">
                                    <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>{(p.totalHomepass || 0).toLocaleString()} HP</span>
                                  </span>
                                </td>

                                {/* Topologi FDT / FAT (Single Line No-Wrap Pills) */}
                                <td className="py-4 px-4 text-center align-middle whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-[11px] whitespace-nowrap">
                                      {p.totalFdt} FDT
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[11px] whitespace-nowrap">
                                      {p.totalFat} FAT
                                    </span>
                                  </div>
                                </td>

                                {/* Kabel FO & Tiang */}
                                <td className="py-4 px-4 text-center align-middle whitespace-nowrap">
                                  <div className="font-extrabold text-amber-400 text-xs whitespace-nowrap">
                                    {(p.totalCableLengthM || 0).toLocaleString()} m FO
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                                    {p.totalPoles} Tiang • {(p.totalSlingWireM || 0).toLocaleString()}m Sling
                                  </div>
                                </td>

                                {/* Waktu Convert */}
                                <td className="py-4 px-4 align-middle whitespace-nowrap">
                                  <div className="text-slate-200 font-semibold text-[11px] whitespace-nowrap">
                                    {dateStr}
                                  </div>
                                  <div className="text-slate-500 font-mono text-[10px] mt-0.5 whitespace-nowrap">
                                    {timeStr}
                                  </div>
                                </td>

                                {/* Preview & Export Excel Actions (Strictly Single Line) */}
                                <td className="py-4 px-5 text-right align-middle whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                                    {/* Segmented Preview Buttons */}
                                    <div className="inline-flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                                      <button
                                        onClick={() => openClusterInView(p.id, 'HPDB')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 font-bold text-[11px] transition whitespace-nowrap"
                                        title="Buka Preview Tabel Excel HPDB"
                                      >
                                        Tabel HPDB
                                      </button>
                                      <button
                                        onClick={() => openClusterInView(p.id, 'BOQ')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 font-bold text-[11px] transition whitespace-nowrap"
                                        title="Buka Preview Tabel Excel BoQ"
                                      >
                                        Tabel BoQ
                                      </button>
                                      <button
                                        onClick={() => openClusterInView(p.id, 'MAP')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 font-bold text-[11px] transition whitespace-nowrap"
                                        title="Buka Peta Topologi GIS"
                                      >
                                        Peta GIS
                                      </button>
                                    </div>

                                    {/* Direct Excel Export Buttons */}
                                    <button
                                      onClick={() => handleDownloadHpdb(p)}
                                      disabled={exportingClusterKey === `${p.id}-hpdb`}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-md shadow-emerald-950/50 transition disabled:opacity-50 whitespace-nowrap"
                                      title="Download File Excel HPDB.xlsx"
                                    >
                                      <Download className="w-3.5 h-3.5 shrink-0" />
                                      <span>HPDB.xlsx</span>
                                    </button>

                                    <button
                                      onClick={() => handleDownloadBoq(p)}
                                      disabled={exportingClusterKey === `${p.id}-boq`}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-md shadow-amber-950/50 transition disabled:opacity-50 whitespace-nowrap"
                                      title="Download File Excel BOQ.xlsx"
                                    >
                                      <Download className="w-3.5 h-3.5 shrink-0" />
                                      <span>BOQ.xlsx</span>
                                    </button>

                                    <button
                                      onClick={() => handleDownloadDwg(p)}
                                      disabled={exportingClusterKey === `${p.id}-dwg`}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[11px] shadow-md shadow-cyan-950/50 transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                      title="Download Gambar AutoCAD DWG (.dwg)"
                                    >
                                      <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>{exportingClusterKey === `${p.id}-dwg` ? 'DWG...' : 'DWG'}</span>
                                    </button>

                                    {/* Delete Action */}
                                    <button
                                      onClick={() => handleDeleteProject(p)}
                                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 transition shrink-0"
                                      title="Hapus Cluster"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Interactive Pagination Footer Bar */}
                    <div className="px-6 py-3.5 bg-slate-950/90 border-t border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-3 text-slate-400">
                        <span>
                          Menampilkan{' '}
                          <strong className="text-white">
                            {(safeClusterPage - 1) * clusterPageSize + 1}
                          </strong>{' '}
                          –{' '}
                          <strong className="text-white">
                            {Math.min(safeClusterPage * clusterPageSize, filteredProjects.length)}
                          </strong>{' '}
                          dari <strong className="text-cyan-400">{filteredProjects.length}</strong> cluster
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">• Baris per halaman:</span>
                          <select
                            value={clusterPageSize}
                            onChange={(e) => setClusterPageSize(Number(e.target.value))}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-white font-bold text-xs focus:outline-none focus:border-cyan-500"
                          >
                            {[5, 10, 20, 50].map((sz) => (
                              <option key={sz} value={sz}>
                                {sz} Baris
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setClusterPage(1)}
                          disabled={safeClusterPage <= 1}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none font-bold transition"
                          title="Halaman Pertama"
                        >
                          «
                        </button>
                        <button
                          type="button"
                          onClick={() => setClusterPage((p) => Math.max(1, p - 1))}
                          disabled={safeClusterPage <= 1}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none font-bold transition"
                        >
                          ‹ Prev
                        </button>

                        <div className="flex items-center gap-1 px-1">
                          {Array.from({ length: totalClusterPages }, (_, i) => i + 1).map((pageNum) => (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setClusterPage(pageNum)}
                              className={`w-8 h-8 rounded-lg font-extrabold text-xs transition ${
                                safeClusterPage === pageNum
                                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {pageNum}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setClusterPage((p) => Math.min(totalClusterPages, p + 1))}
                          disabled={safeClusterPage >= totalClusterPages}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none font-bold transition"
                        >
                          Next ›
                        </button>
                        <button
                          type="button"
                          onClick={() => setClusterPage(totalClusterPages)}
                          disabled={safeClusterPage >= totalClusterPages}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none font-bold transition"
                          title="Halaman Terakhir"
                        >
                          »
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              VIEW 3: ACTIVE CLUSTER WORKSPACE (HPDB / BOQ / MAP)
              ================================================================= */}
          {['HPDB', 'BOQ', 'MAP'].includes(activeMenu) && activeProject && (
            <div className="space-y-5">
              {/* Active Cluster Header Bar */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                        {activeProject.clusterCode}
                      </span>
                      <h2 className="text-base font-extrabold text-white">
                        {activeProject.clusterName}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      File KMZ: <strong className="text-slate-200">{activeProject.kmzFileName}</strong> • Wilayah:{' '}
                      <strong className="text-slate-200">
                        {activeProject.subdistrict}, {activeProject.district}, {activeProject.regencyCity} ({activeProject.province})
                      </strong>
                      {activeProject.createdBy && (
                        <>
                          {' '}
                          • Drafter:{' '}
                          <strong className="text-cyan-300">
                            {activeProject.createdBy.fullName} (@{activeProject.createdBy.username})
                          </strong>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Quick View Switcher & Export Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                      <button
                        onClick={() => setActiveMenu('HPDB')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition ${
                          activeMenu === 'HPDB'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Excel HPDB
                      </button>
                      <button
                        onClick={() => {
                          if (!isBoqAllowed) {
                            showToast(
                              'Tabel BoQ tidak termasuk dalam Paket BASIC. Silakan upgrade ke Paket PRO atau ULTRA!',
                              'error'
                            );
                            openUpgradeModal('PRO');
                            return;
                          }
                          setActiveMenu('BOQ');
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition ${
                          activeMenu === 'BOQ'
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {isBoqAllowed ? 'Excel BoQ' : 'Excel BoQ 🔒'}
                      </button>
                      <button
                        onClick={() => setActiveMenu('MAP')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition ${
                          activeMenu === 'MAP'
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Peta KMZ
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadDwg(activeProject)}
                      disabled={exportingDwg}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition shadow-md shadow-cyan-950/40 cursor-pointer disabled:opacity-50"
                      title="Download Gambar Kerja AutoCAD DWG (.dwg)"
                    >
                      <FileCode2 className="w-3.5 h-3.5 text-slate-950" />
                      <span>{exportingDwg ? 'Exporting DWG...' : 'Export DWG'}</span>
                    </button>

                    <button
                      onClick={() => setShowEditModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Edit Wilayah &amp; BoM</span>
                    </button>

                    <button
                      onClick={() => handleDeleteProject(activeProject)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-semibold transition"
                      title="Hapus Cluster Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Cluster</span>
                    </button>
                  </div>
                </div>

                {/* 4 KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Total Homepass (HPDB)</div>
                      <div className="text-base font-extrabold text-white">
                        {(activeProject.totalHomepass || 0).toLocaleString()} HP
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Distribusi FDT &amp; FAT</div>
                      <div className="text-base font-extrabold text-white">
                        {activeProject.totalFdt} FDT • {activeProject.totalFat} FAT
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Cable className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Kabel FO (24C/36C/48C) &amp; Sling</div>
                      <div className="text-base font-extrabold text-white">
                        {(activeProject.totalCableLengthM || 0).toLocaleString()}m / {activeProject.totalSlingWireM || 0}m
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Total Tiang (Poles)</div>
                      <div className="text-base font-extrabold text-white">
                        {activeProject.totalPoles || 0} Tiang
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {loadingProject ? (
                <div className="p-16 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
                  Memuat data topologi, FAT, tiang, dan baris Homepass...
                </div>
              ) : activeMenu === 'HPDB' ? (
                <HpdbExcelPreview
                  project={activeProject}
                  onExportHpdb={() => handleDownloadHpdb(activeProject)}
                  exporting={exportingHpdb}
                />
              ) : activeMenu === 'BOQ' ? (
                <BoqExcelPreview
                  project={activeProject}
                  onDownloadBoq={() => handleDownloadBoq(activeProject)}
                  exportingBoq={exportingBoq}
                />
              ) : (
                <TopologyMap project={activeProject} />
              )}
            </div>
          )}

          {/* =================================================================
              VIEW 4: ADMIN PANEL (MONITORING PER-USER & APPROVAL)
              ================================================================= */}
          {activeMenu === 'ADMIN' && user.role === 'ADMIN' && (
            <AdminDashboard
              currentUser={user}
              onInspectProject={(projectId) => openClusterInView(projectId, 'HPDB')}
              onProjectsChanged={() => fetchProjects()}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Modal Edit Project Metadata & FDT Quantities */}
      {showEditModal && activeProject && (
        <ProjectEditorModal
          project={activeProject}
          onClose={() => setShowEditModal(false)}
          onSaved={(updatedProj) => {
            setActiveProject(updatedProj);
            fetchProjects(updatedProj.id);
            showToast('Parameter wilayah & kuantitas BoM berhasil diperbarui!');
          }}
        />
      )}

      {/* =====================================================================
          MODAL PROSES KONVERSI KMZ KE HPDB & BOQ
          ===================================================================== */}
      {convertModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {convertModal.status === 'PROCESSING' && (
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20 shrink-0">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
                {convertModal.status === 'SUCCESS' && (
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
                {convertModal.status === 'ERROR' && (
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20 shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                )}

                <div>
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    {convertModal.status === 'PROCESSING' && 'Memproses Konversi File KMZ...'}
                    {convertModal.status === 'SUCCESS' && 'Konversi KMZ Berhasil Selesai!'}
                    {convertModal.status === 'ERROR' && 'Konversi File KMZ Gagal'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {convertModal.status === 'PROCESSING' &&
                      'Mohon tunggu, sistem sedang mengekstrak topologi ke Excel HPDB & BoQ'}
                    {convertModal.status === 'SUCCESS' &&
                      'Data cluster telah disimpan dan siap diunduh dalam format Excel standar'}
                    {convertModal.status === 'ERROR' &&
                      'Terjadi kendala saat mengekstrak struktur file KMZ/KML Anda'}
                  </p>
                </div>
              </div>

              {convertModal.status !== 'PROCESSING' && (
                <button
                  type="button"
                  onClick={() => setConvertModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title="Tutup Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* File Info & Progress Bar */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <UploadCloud className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-mono font-bold text-slate-200 truncate">
                      {convertModal.fileName}
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      ({convertModal.fileSizeKb} KB)
                    </span>
                  </div>
                  <span
                    className={`font-mono font-extrabold text-xs shrink-0 ${
                      convertModal.status === 'SUCCESS'
                        ? 'text-emerald-400'
                        : convertModal.status === 'ERROR'
                        ? 'text-red-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    {convertModal.progress}%
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      convertModal.status === 'SUCCESS'
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        : convertModal.status === 'ERROR'
                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                        : 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500'
                    }`}
                    style={{ width: `${convertModal.progress}%` }}
                  />
                </div>
              </div>

              {/* Error Alert if Failed */}
              {convertModal.status === 'ERROR' && (
                <div className="p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-300 mb-0.5">Detail Kendala Konversi:</div>
                    <div>{convertModal.errorMsg}</div>
                  </div>
                </div>
              )}

              {/* 4 Engineering Pipeline Steps */}
              <div className="space-y-2.5">
                {[
                  {
                    title: 'Mengekstrak Arsip KMZ & Struktur XML/KML',
                    desc: 'Membaca dokumen KML, folder DISTRIBUTION, Boundary, dan atribut koordinat'
                  },
                  {
                    title: 'Memetakan Topologi FDT, Line A/B/C/D & Snapping Tiang',
                    desc: 'Mendeteksi titik FDT, FAT, serta snapping otomatis ke Pole ID terdekat'
                  },
                  {
                    title: 'Sinkronisasi Homepass (HP Cover) & Kalkulasi Rute Kabel',
                    desc: 'Menghitung titik Homepass per FAT, kabel FO distribusi, & jalur Kabel Sling'
                  },
                  {
                    title: 'Menyusun Format Standar Excel HPDB.xlsx & BOQ.xlsx',
                    desc: 'Menyiapkan 58 kolom HPDB (A–BF), sheet BoQ, dan menyimpan ke database'
                  }
                ].map((step, idx) => {
                  const isDone = convertModal.stepIndex > idx;
                  const isCurrent =
                    convertModal.stepIndex === idx && convertModal.status === 'PROCESSING';

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : isCurrent
                          ? 'bg-cyan-950/30 border-cyan-400/50 shadow-md shadow-cyan-950/40'
                          : 'bg-slate-950/50 border-slate-800/80 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isDone ? (
                          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-[11px] font-mono font-bold text-slate-400 shrink-0">
                            {idx + 1}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div
                            className={`text-xs font-extrabold truncate ${
                              isDone
                                ? 'text-emerald-300'
                                : isCurrent
                                ? 'text-white'
                                : 'text-slate-300'
                            }`}
                          >
                            {step.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {step.desc}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                          isDone
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : isCurrent
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {isDone ? 'Selesai' : isCurrent ? 'Memproses' : 'Menunggu'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Result Summary Card inside Modal when Complete */}
              {convertModal.status === 'SUCCESS' && convertModal.resultProject && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                        Cluster Berhasil Diekstrak
                      </span>
                      <div className="text-sm font-extrabold text-white mt-0.5">
                        {convertModal.resultProject.clusterCode} —{' '}
                        {convertModal.resultProject.clusterName}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Homepass</div>
                      <div className="text-xs font-extrabold text-emerald-400 mt-0.5">
                        {(convertModal.resultProject.totalHomepass || 0).toLocaleString()} HP
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Total FDT</div>
                      <div className="text-xs font-extrabold text-cyan-300 mt-0.5">
                        {convertModal.resultProject.totalFdt || 0} FDT
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Total FAT</div>
                      <div className="text-xs font-extrabold text-indigo-300 mt-0.5">
                        {convertModal.resultProject.totalFat || 0} FAT
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Kabel FO</div>
                      <div className="text-xs font-extrabold text-amber-400 mt-0.5">
                        {(convertModal.resultProject.totalCableLengthM || 0).toLocaleString()} m
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              {convertModal.status === 'PROCESSING' ? (
                <div className="w-full text-center text-xs text-slate-400 flex items-center justify-center gap-2 py-1">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>Harap jangan menutup halaman selama proses ekstraksi KMZ berlangsung...</span>
                </div>
              ) : convertModal.status === 'SUCCESS' && convertModal.resultProject ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadHpdb(convertModal.resultProject)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download HPDB.xlsx</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadBoq(convertModal.resultProject)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download BOQ.xlsx</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = convertModal.resultProject.id;
                        setConvertModal((prev) => ({ ...prev, isOpen: false }));
                        openClusterInView(targetId, 'HPDB');
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Buka Tabel HPDB ➔</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConvertModal((prev) => ({ ...prev, isOpen: false }))}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                    >
                      Tutup
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex justify-end">
                  <button
                    type="button"
                    onClick={() => setConvertModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
                  >
                    Tutup &amp; Coba Lagi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL KONFIRMASI HAPUS CLUSTER KMZ
          ===================================================================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteProjectTarget)}
        type="PROJECT"
        item={deleteProjectTarget}
        confirmText="Ya, Hapus Cluster Permanen"
        loading={deletingProject}
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => {
          if (!deletingProject) setDeleteProjectTarget(null);
        }}
      />

      {/* =====================================================================
          MODAL UPGRADE / PERPANJANG PAKET (QRIS DANA BISNIS)
          ===================================================================== */}
      <DanaPaymentModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        user={user}
        defaultPlanCode={upgradeDefaultPlan}
        onPaymentSuccess={(payData) => {
          setUpgradeModalOpen(false);
          if (payData?.token) setToken(payData.token);
          if (payData?.user) setUser(payData.user);
          showToast(
            payData?.message ||
              `Pembayaran DANA Bisnis berhasil! Paket ${payData?.user?.subscriptionPlan || ''} telah aktif otomatis.`
          );
        }}
      />

      {/* =====================================================================
          MODAL KONVERSI AUTOCAD DWG KE GOOGLE EARTH KMZ
          ===================================================================== */}
      <DwgConverterModal
        isOpen={dwgModalOpen}
        onClose={() => setDwgModalOpen(false)}
        onProjectCreated={(newProj) => {
          setDwgModalOpen(false);
          setActiveProject(newProj);
          fetchProjects(newProj.id);
          setActiveMenu('HPDB');
          showToast(`Proyek AutoCAD DWG "${newProj.clusterName}" berhasil dikonversi dan dibuka!`);
        }}
      />

      {/* =====================================================================
          MODAL KONVERSI GOOGLE EARTH KMZ KE AUTOCAD DWG / DXF
          ===================================================================== */}
      <KmzToDwgModal
        isOpen={kmzToDwgModalOpen}
        onClose={() => setKmzToDwgModalOpen(false)}
      />
    </div>
  );
}
