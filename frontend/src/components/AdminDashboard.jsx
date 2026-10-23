import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Users,
  Activity,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  FolderKanban,
  FileSpreadsheet,
  Eye,
  Download,
  Home,
  Radio,
  Cable,
  User,
  Loader2,
  X,
  AlertTriangle,
  QrCode,
  Upload,
  CreditCard,
  Save
} from 'lucide-react';
import { apiFetch, downloadExcelFile } from '../api';
import ConfirmDeleteModal from './ConfirmDeleteModal';

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(num || 0));
}

export default function AdminDashboard({
  currentUser,
  onInspectProject,
  onProjectsChanged,
  onShowToast
}) {
  const [adminTab, setAdminTab] = useState('USER_CLUSTERS'); // 'USER_CLUSTERS' | 'APPROVALS' | 'PAYMENTS' | 'LOGS'
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Payment Gateway & DANA Bisnis QRIS Settings State
  const [paymentSettings, setPaymentSettings] = useState({
    merchantName: 'TOSKA FTTH SND STUDIO - DANA BISNIS',
    merchantNmid: 'ID2026000088991',
    danaPhoneNumber: '0812-XXXX-XXXX',
    qrisImageUrl: '',
    autoVerifyMode: true,
    basicPrice: 100000,
    basicLimit: 10,
    proPrice: 250000,
    proLimit: 30,
    ultraPrice: 500000,
    ultraLimit: -1
  });
  const [transactions, setTransactions] = useState([]);
  const [savingPayment, setSavingPayment] = useState(false);

  // Filters for User Approval tab
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Filters for Per-User Clusters tab
  const [selectedUserId, setSelectedUserId] = useState('ALL');
  const [clusterSearch, setClusterSearch] = useState('');
  const [downloadingKey, setDownloadingKey] = useState(null);

  // Custom Modals State (Delete User, Delete Cluster, Reject User)
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteClusterTarget, setDeleteClusterTarget] = useState(null);
  const [deletingCluster, setDeletingCluster] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('Data akun belum terverifikasi');
  const [rejectingUser, setRejectingUser] = useState(false);

  const notify = (msg, type = 'success') => {
    if (onShowToast) {
      onShowToast(msg, type);
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, logsRes, statsRes, payRes] = await Promise.all([
        apiFetch('/admin/users'),
        apiFetch('/admin/audit-logs'),
        apiFetch('/admin/stats'),
        apiFetch('/admin/payment-settings').catch(() => null)
      ]);
      setUsers(usersRes.users || []);
      setAuditLogs(logsRes.logs || []);
      setStats(statsRes || null);
      if (payRes?.settings) {
        setPaymentSettings((prev) => ({
          ...prev,
          ...payRes.settings,
          qrisImageUrl: payRes.settings.qrisImageUrl || ''
        }));
      }
      if (payRes?.transactions) {
        setTransactions(payRes.transactions);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleQrisImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      notify('Ukuran gambar QRIS maksimal 8 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentSettings((prev) => ({
        ...prev,
        qrisImageUrl: String(reader.result || '')
      }));
      notify('Gambar Barcode QRIS DANA Bisnis siap disimpan! Klik tombol Simpan Pengaturan.');
    };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingPayment(true);
    try {
      const res = await apiFetch('/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(paymentSettings)
      });
      if (res?.settings) {
        setPaymentSettings((prev) => ({
          ...prev,
          ...res.settings,
          qrisImageUrl: res.settings.qrisImageUrl || ''
        }));
      }
      notify(res?.message || 'Pengaturan Barcode QRIS DANA Bisnis & Paket berhasil disimpan!');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleChangeUserSubscription = async (userId, planCode) => {
    setActionLoadingId(userId);
    try {
      const res = await apiFetch(`/admin/users/${userId}/subscription`, {
        method: 'PUT',
        body: JSON.stringify({ planCode, resetQuota: true })
      });
      await loadAdminData();
      notify(res?.message || `Paket langganan user berhasil diubah ke ${planCode}.`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleVerifyInvoiceAdmin = async (invoiceNumber) => {
    setActionLoadingId(invoiceNumber);
    try {
      const res = await apiFetch(`/payments/verify-auto/${invoiceNumber}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await loadAdminData();
      notify(res?.message || `Tagihan ${invoiceNumber} berhasil diverifikasi & akun diaktifkan!`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (userId) => {
    setActionLoadingId(userId);
    try {
      const res = await apiFetch(`/admin/users/${userId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      await loadAdminData();
      notify(res?.message || 'Akun pengguna berhasil disetujui (APPROVED).');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenRejectModal = (userObj) => {
    setRejectTarget(userObj);
    setRejectReason('Data akun belum terverifikasi');
  };

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    if (!rejectTarget) return;
    setRejectingUser(true);
    setActionLoadingId(rejectTarget.id);
    try {
      const res = await apiFetch(`/admin/users/${rejectTarget.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectReason })
      });
      await loadAdminData();
      notify(res?.message || `Pendaftaran akun "${rejectTarget.fullName}" telah ditolak.`);
      setRejectTarget(null);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setRejectingUser(false);
      setActionLoadingId(null);
    }
  };

  const handleRoleChange = async (userId, currentStatus, newRole) => {
    setActionLoadingId(userId);
    try {
      const res = await apiFetch(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: currentStatus, role: newRole })
      });
      await loadAdminData();
      notify(res?.message || `Role pengguna berhasil diubah menjadi ${newRole}.`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = (userObj) => {
    setDeleteUserTarget(userObj);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    setActionLoadingId(deleteUserTarget.id);
    try {
      await apiFetch(`/admin/users/${deleteUserTarget.id}`, { method: 'DELETE' });
      const deletedName = `${deleteUserTarget.fullName} (@${deleteUserTarget.username})`;
      setDeleteUserTarget(null);
      await loadAdminData();
      if (onProjectsChanged) onProjectsChanged();
      notify(`Akun "${deletedName}" telah dihapus secara permanen.`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDeletingUser(false);
      setActionLoadingId(null);
    }
  };

  const handleDeleteCluster = (clusterObj, ownerUser) => {
    setDeleteClusterTarget({
      ...clusterObj,
      createdBy: clusterObj.createdBy || (ownerUser ? { fullName: ownerUser.fullName, username: ownerUser.username } : null)
    });
  };

  const handleConfirmDeleteCluster = async () => {
    if (!deleteClusterTarget) return;
    setDeletingCluster(true);
    try {
      await apiFetch(`/projects/${deleteClusterTarget.id}`, { method: 'DELETE' });
      const deletedClusterName = deleteClusterTarget.clusterName;
      setDeleteClusterTarget(null);
      await loadAdminData();
      if (onProjectsChanged) onProjectsChanged();
      notify(`Cluster "${deletedClusterName}" berhasil dihapus secara permanen.`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDeletingCluster(false);
    }
  };

  const handleAdminDownload = async (cluster, type) => {
    const key = `${cluster.id}-${type}`;
    setDownloadingKey(key);
    try {
      const safeName = `${type.toUpperCase()} - ${cluster.clusterCode} - ${cluster.clusterName}.xlsx`;
      await downloadExcelFile(`/projects/${cluster.id}/export/${type}`, safeName);
      notify(`File Excel (${safeName}) berhasil diunduh!`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDownloadingKey(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (filterStatus !== 'ALL' && u.status !== filterStatus) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.region || '').toLowerCase().includes(q)
    );
  });

  // Flatten or group clusters by user for the Per-User Cluster Monitoring tab
  const displayedUserGroups = useMemo(() => {
    const q = clusterSearch.trim().toLowerCase();
    return users
      .filter((u) => selectedUserId === 'ALL' || u.id === selectedUserId)
      .map((u) => {
        const userClusters = (u.projects || []).filter((p) => {
          if (!q) return true;
          return (
            p.clusterName.toLowerCase().includes(q) ||
            p.clusterCode.toLowerCase().includes(q) ||
            (p.kmzFileName || '').toLowerCase().includes(q) ||
            (p.regencyCity || '').toLowerCase().includes(q)
          );
        });
        const totalHp = userClusters.reduce((acc, p) => acc + (p.totalHomepass || 0), 0);
        return {
          user: u,
          clusters: userClusters,
          totalHp
        };
      })
      .filter((group) => selectedUserId !== 'ALL' || group.clusters.length > 0 || !q);
  }, [users, selectedUserId, clusterSearch]);

  const pendingCount = users.filter((u) => u.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Top KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Menunggu Approval Admin</div>
            <div className="text-2xl font-extrabold text-amber-400 mt-1">{pendingCount} Akun</div>
            <div className="text-[11px] text-slate-500 mt-1">Wajib di-approve agar bisa login</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Drafter &amp; Admin Aktif</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">
              {stats?.approvedUsers ?? users.filter((u) => u.status === 'APPROVED').length} Akun
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Status APPROVED</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Total Cluster Dikonversi</div>
            <div className="text-2xl font-extrabold text-cyan-400 mt-1">
              {stats?.totalProjects ?? 0} Cluster
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {(stats?.totalHomepass ?? 0).toLocaleString()} Total Homepass
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FolderKanban className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Total Ekspor Excel (HPDB &amp; BoQ)</div>
            <div className="text-2xl font-extrabold text-purple-400 mt-1">
              {stats?.totalExports ?? 0} File
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Tercatat di `ExportHistory`</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar for Admin */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAdminTab('USER_CLUSTERS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              adminTab === 'USER_CLUSTERS'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Monitoring Cluster Per Drafter / User</span>
          </button>

          <button
            onClick={() => setAdminTab('APPROVALS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              adminTab === 'APPROVALS'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Manajemen User &amp; Paket</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                {pendingCount} Pending
              </span>
            )}
          </button>

          <button
            onClick={() => setAdminTab('PAYMENTS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              adminTab === 'PAYMENTS'
                ? 'bg-gradient-to-r from-[#118EEA] to-cyan-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Payment Gateway &amp; Barcode DANA Bisnis</span>
          </button>

          <button
            onClick={() => setAdminTab('LOGS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              adminTab === 'LOGS'
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Log Audit Sistem</span>
          </button>
        </div>

        <button
          onClick={loadAdminData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: MONITORING CLUSTER PER USER / DRAFTER
          ===================================================================== */}
      {adminTab === 'USER_CLUSTERS' && (
        <div className="space-y-5">
          {/* User Selector Pills & Search */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Filter &amp; Lihat Hasil Convert KMZ Per User / Drafter</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pilih nama Drafter di bawah untuk melihat daftar cluster KMZ yang telah dikonversi oleh user tersebut
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clusterSearch}
                  onChange={(e) => setClusterSearch(e.target.value)}
                  placeholder="Cari nama cluster / kode / kota..."
                  className="pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
                />
              </div>
            </div>

            {/* Horizontal User Filter Cards */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={() => setSelectedUserId('ALL')}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${
                  selectedUserId === 'ALL'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Semua User ({stats?.totalProjects ?? 0} Cluster)</span>
              </button>

              {users
                .filter((u) => u.status === 'APPROVED')
                .map((u) => {
                  const count = u.projects?.length || 0;
                  const isSel = selectedUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-2 ${
                        isSel
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{u.fullName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">@{u.username}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          count > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {count} Cluster
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Per-User Cluster Groups */}
          {displayedUserGroups.map(({ user: u, clusters, totalHp }) => (
            <div
              key={u.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
            >
              {/* User Group Header */}
              <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-extrabold text-sm">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{u.fullName}</span>
                      <span className="text-xs font-mono text-cyan-400">@{u.username}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {u.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {u.department || 'SND FTTH'} • Area: <strong>{u.region || '-'}</strong> • Email: {u.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Total Dikonversi: </span>
                    <strong className="text-cyan-300">{clusters.length} Cluster</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Total Homepass: </span>
                    <strong className="text-emerald-400">{totalHp.toLocaleString()} HP</strong>
                  </div>
                </div>
              </div>

              {/* User's Converted Clusters Table */}
              {clusters.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  User <strong>{u.fullName}</strong> belum mengonversi file cluster KMZ apa pun.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-12 text-center">No</th>
                        <th className="py-3.5 px-4 min-w-[200px]">Kode &amp; Nama Cluster</th>
                        <th className="py-3.5 px-4 min-w-[210px]">File KMZ &amp; Wilayah</th>
                        <th className="py-3.5 px-4 text-center whitespace-nowrap">Homepass</th>
                        <th className="py-3.5 px-4 text-center whitespace-nowrap">Topologi FDT / FAT</th>
                        <th className="py-3.5 px-4 text-center whitespace-nowrap">Kabel FO &amp; Tiang</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Waktu Convert</th>
                        <th className="py-3.5 px-5 text-right whitespace-nowrap">Aksi Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {clusters.map((c, idx) => {
                        const createdDate = new Date(c.createdAt);
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
                          <tr key={c.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 text-center align-middle">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-slate-400">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 align-middle">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                                {c.clusterCode}
                              </span>
                              <div className="font-extrabold text-white mt-1.5">{c.clusterName}</div>
                            </td>
                            <td className="py-3.5 px-4 align-middle">
                              <div
                                className="font-mono text-[11px] text-slate-200 truncate max-w-[230px]"
                                title={c.kmzFileName}
                              >
                                {c.kmzFileName}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 truncate max-w-[230px]">
                                {c.regencyCity} ({c.province})
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                              <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-extrabold text-xs whitespace-nowrap">
                                <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{(c.totalHomepass || 0).toLocaleString()} HP</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-[11px] whitespace-nowrap">
                                  {c.totalFdt} FDT
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[11px] whitespace-nowrap">
                                  {c.totalFat} FAT
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                              <div className="font-extrabold text-amber-400 whitespace-nowrap">
                                {(c.totalCableLengthM || 0).toLocaleString()} m FO
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                                {c.totalPoles} Tiang
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div className="text-slate-200 font-semibold text-[11px] whitespace-nowrap">
                                {dateStr}
                              </div>
                              <div className="text-slate-500 font-mono text-[10px] mt-0.5 whitespace-nowrap">
                                {timeStr}
                              </div>
                            </td>
                            <td className="py-3.5 px-5 text-right align-middle whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                                <button
                                  onClick={() => onInspectProject && onInspectProject(c.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-[11px] transition whitespace-nowrap"
                                  title="Buka & Lihat Detail Spreadsheet Cluster Ini"
                                >
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                  <span>Buka Preview</span>
                                </button>
                                <button
                                  onClick={() => handleAdminDownload(c, 'hpdb')}
                                  disabled={downloadingKey === `${c.id}-hpdb`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition disabled:opacity-50 whitespace-nowrap"
                                  title="Download Excel HPDB"
                                >
                                  <Download className="w-3.5 h-3.5 shrink-0" />
                                  <span>HPDB.xlsx</span>
                                </button>
                                <button
                                  onClick={() => handleAdminDownload(c, 'boq')}
                                  disabled={downloadingKey === `${c.id}-boq`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition disabled:opacity-50 whitespace-nowrap"
                                  title="Download Excel BoQ"
                                >
                                  <Download className="w-3.5 h-3.5 shrink-0" />
                                  <span>BOQ.xlsx</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteCluster(c, u)}
                                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 transition shrink-0"
                                  title="Hapus Cluster Ini"
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* =====================================================================
          TAB 2: MANAJEMEN AKUN & APPROVAL PENDAFTAR
          ===================================================================== */}
      {adminTab === 'APPROVALS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Manajemen Akun Drafter SND &amp; Verifikasi Pendaftaran
                </h3>
                <p className="text-xs text-slate-400">
                  Setujui (Approve) pendaftar baru agar mereka dapat mengakses konverter KMZ ke HPDB &amp; BoQ
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {[
                  { key: 'ALL', label: `Semua (${users.length})` },
                  { key: 'PENDING', label: `Pending (${pendingCount})` },
                  { key: 'APPROVED', label: 'Approved' },
                  { key: 'REJECTED', label: 'Rejected' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterStatus(tab.key)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                      filterStatus === tab.key
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama, username, email..."
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Drafter / Pengguna</th>
                  <th className="py-3 px-4">Departemen &amp; Regional</th>
                  <th className="py-3 px-4">Paket &amp; Kuota Bulanan</th>
                  <th className="py-3 px-4">Role Sistem</th>
                  <th className="py-3 px-4">Status Approval</th>
                  <th className="py-3 px-4">Cluster Dikonversi</th>
                  <th className="py-3 px-4">Waktu Daftar</th>
                  <th className="py-3 px-4 text-right">Aksi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{u.fullName}</div>
                      <div className="text-slate-400 text-[11px]">
                        @{u.username} • {u.email}
                      </div>
                      {u.employeeId && (
                        <div className="text-cyan-400 text-[10px] font-mono">NIK: {u.employeeId}</div>
                      )}
                      {u.phone && <div className="text-slate-500 text-[10px]">{u.phone}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-200 font-medium">{u.department || 'SND FTTH'}</div>
                      <div className="text-slate-400 text-[11px]">{u.region || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.role === 'ADMIN' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-extrabold text-[11px]">
                          ADMIN (∞)
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <select
                            value={u.subscriptionPlan || 'BASIC'}
                            disabled={actionLoadingId === u.id}
                            onChange={(e) => handleChangeUserSubscription(u.id, e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-cyan-300 font-extrabold"
                          >
                            <option value="BASIC">BASIC (10x / No BoQ)</option>
                            <option value="PRO">PRO (30x + BoQ)</option>
                            <option value="ULTRA">ULTRA (Unlimited + BoQ)</option>
                          </select>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Terpakai: {u.monthlyConvertUsed || 0} /{' '}
                            {u.monthlyConvertLimit === -1 ? '∞' : u.monthlyConvertLimit || 10}x
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        disabled={u.id === currentUser.id || actionLoadingId === u.id}
                        onChange={(e) => handleRoleChange(u.id, u.status, e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-semibold"
                      >
                        <option value="DRAFTER">DRAFTER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          APPROVED ({u.subscriptionStatus || 'ACTIVE'})
                        </span>
                      )}
                      {u.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                          <Clock className="w-3.5 h-3.5" />
                          UNPAID / PENDING
                        </span>
                      )}
                      {u.status === 'REJECTED' && (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-300 border border-red-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            REJECTED
                          </span>
                          {u.rejectionReason && (
                            <div className="text-[10px] text-red-400 mt-1">{u.rejectionReason}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setAdminTab('USER_CLUSTERS');
                        }}
                        className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                      >
                        {u._count?.projects ?? 0} Cluster ➔
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(u.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.status !== 'APPROVED' && (
                          <button
                            onClick={() => handleApprove(u.id)}
                            disabled={actionLoadingId === u.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        {u.status !== 'REJECTED' && u.id !== currentUser.id && (
                          <button
                            onClick={() => handleOpenRejectModal(u)}
                            disabled={actionLoadingId === u.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs transition"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        )}
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={actionLoadingId === u.id}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 transition"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2.5: PAYMENT GATEWAY & BARCODE QRIS DANA BISNIS
          ===================================================================== */}
      {adminTab === 'PAYMENTS' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSavePaymentSettings}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Left Column: Upload Barcode QRIS DANA Bisnis */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-[#118EEA]/20 border border-[#118EEA]/40 flex items-center justify-center text-cyan-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Barcode QRIS DANA Bisnis Anda
                  </h3>
                  <p className="text-xs text-slate-400">
                    Unggah gambar Barcode QRIS DANA Bisnis Anda agar tampil otomatis saat Drafter membayar
                  </p>
                </div>
              </div>

              {/* QRIS Image Preview Box */}
              <div className="bg-white rounded-2xl p-4 text-slate-900 border-2 border-[#118EEA] shadow-lg text-center space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-left">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#118EEA]">
                      PREVIEW QRIS DANA BISNIS
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 truncate max-w-[210px]">
                      {paymentSettings.merchantName}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#118EEA] text-white text-[10px] font-black">
                    QRIS DANA
                  </span>
                </div>

                {paymentSettings.qrisImageUrl ? (
                  <div className="py-2">
                    <img
                      src={paymentSettings.qrisImageUrl}
                      alt="Barcode QRIS DANA Bisnis"
                      className="max-h-60 mx-auto rounded-xl object-contain border border-slate-200"
                    />
                  </div>
                ) : (
                  <div className="py-8 px-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
                    Belum ada gambar Barcode QRIS DANA Bisnis yang diunggah. Klik tombol{' '}
                    <strong>Pilih Gambar Barcode DANA Bisnis</strong> di bawah untuk memasukkan gambar QRIS Anda.
                  </div>
                )}

                <div className="text-[11px] text-slate-600 font-mono">
                  NMID: {paymentSettings.merchantNmid} • DANA: {paymentSettings.danaPhoneNumber}
                </div>
              </div>

              {/* File Upload Button */}
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#118EEA] hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg transition">
                  <Upload className="w-4 h-4" />
                  <span>Pilih Gambar Barcode DANA Bisnis (.PNG / .JPG)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleQrisImageUpload}
                    className="hidden"
                  />
                </label>
                {paymentSettings.qrisImageUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentSettings((prev) => ({ ...prev, qrisImageUrl: '' }))
                    }
                    className="px-3 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-bold text-xs transition"
                  >
                    Reset Gambar
                  </button>
                )}
              </div>

              {/* Merchant Info Inputs */}
              <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Nama Merchant DANA Bisnis
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.merchantName}
                    onChange={(e) =>
                      setPaymentSettings({ ...paymentSettings, merchantName: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">NMID QRIS</label>
                    <input
                      type="text"
                      value={paymentSettings.merchantNmid}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, merchantNmid: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Nomor Akun DANA Bisnis
                    </label>
                    <input
                      type="text"
                      value={paymentSettings.danaPhoneNumber}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          danaPhoneNumber: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Harga & Kuota Paket Bulanan */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">
                        Konfigurasi Harga &amp; Kuota Paket Drafter Bulanan
                      </h3>
                      <p className="text-xs text-slate-400">
                        Atur tarif langganan dan batas kuota convert KMZ per bulan untuk setiap paket
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold">
                    AUTO-ACTIVATION AKTIF
                  </span>
                </div>

                {/* 3 Package Configuration Cards */}
                <div className="space-y-3.5 text-xs">
                  {/* Paket BASIC */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <div className="font-extrabold text-amber-300 text-sm">1. PAKET BASIC</div>
                      <div className="text-[11px] text-slate-400">
                        HPDB Only • <strong className="text-rose-400">BoQ Tidak Termasuk</strong>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Harga Bulanan (Rp)
                      </label>
                      <input
                        type="number"
                        value={paymentSettings.basicPrice}
                        onChange={(e) =>
                          setPaymentSettings({
                            ...paymentSettings,
                            basicPrice: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Kuota Convert / Bulan
                      </label>
                      <input
                        type="number"
                        value={paymentSettings.basicLimit}
                        onChange={(e) =>
                          setPaymentSettings({
                            ...paymentSettings,
                            basicLimit: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Paket PRO */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <div className="font-extrabold text-cyan-300 text-sm">2. PAKET PRO</div>
                      <div className="text-[11px] text-slate-400">
                        HPDB + <strong className="text-emerald-400">Termasuk BoQ Lengkap</strong>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Harga Bulanan (Rp)
                      </label>
                      <input
                        type="number"
                        value={paymentSettings.proPrice}
                        onChange={(e) =>
                          setPaymentSettings({
                            ...paymentSettings,
                            proPrice: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Kuota Convert / Bulan
                      </label>
                      <input
                        type="number"
                        value={paymentSettings.proLimit}
                        onChange={(e) =>
                          setPaymentSettings({
                            ...paymentSettings,
                            proLimit: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Paket ULTRA */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <div className="font-extrabold text-purple-300 text-sm">3. PAKET ULTRA</div>
                      <div className="text-[11px] text-slate-400">
                        Unlimited Convert + <strong className="text-emerald-400">Full BoQ</strong>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Harga Bulanan (Rp)
                      </label>
                      <input
                        type="number"
                        value={paymentSettings.ultraPrice}
                        onChange={(e) =>
                          setPaymentSettings({
                            ...paymentSettings,
                            ultraPrice: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Kuota Convert / Bulan
                      </label>
                      <input
                        type="text"
                        disabled
                        value="UNLIMITED (∞)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-purple-300 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Webhook Endpoint Info Box */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-bold text-cyan-300">
                    Endpoint Webhook Otomatis DANA Bisnis / Mutasi QRIS:
                  </div>
                  <div className="font-mono text-slate-300">
                    POST http://localhost:5000/api/payments/webhook/dana
                  </div>
                  <div>
                    Setiap transaksi dilengkapi <strong>Kode Unik 3 Digit</strong> sehingga sistem langsung mencocokkan mutasi pembayaran secara otomatis dan mengaktifkan akun Drafter detik itu juga.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPayment}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#118EEA] via-cyan-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {savingPayment
                    ? 'Menyimpan Barcode QRIS & Pengaturan...'
                    : 'Simpan Barcode QRIS DANA Bisnis & Konfigurasi Paket'}
                </span>
              </button>
            </div>
          </form>

          {/* Payment Transactions History Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Riwayat Transaksi &amp; Tagihan QRIS DANA Bisnis ({transactions.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Daftar seluruh invoice pendaftaran dan perpanjangan paket Drafter
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4">No. Invoice</th>
                    <th className="py-3 px-4">Drafter</th>
                    <th className="py-3 px-4">Paket</th>
                    <th className="py-3 px-4">Total Nominal (Kode Unik)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Waktu Transaksi</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Belum ada riwayat transaksi pembayaran.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                          {tx.invoiceNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">
                            {tx.user?.fullName || 'Drafter'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            @{tx.user?.username} • {tx.user?.email}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-white">{tx.planName}</td>
                        <td className="py-3 px-4 font-mono font-extrabold text-amber-300">
                          {formatRupiah(tx.totalAmount)}{' '}
                          <span className="text-[10px] text-slate-400">
                            (+{tx.uniqueCode})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {tx.status === 'PAID' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-extrabold text-[10px]">
                              LUNAS (PAID)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-extrabold text-[10px]">
                              MENUNGGU BAYAR
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(tx.paidAt || tx.createdAt).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {tx.status !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => handleVerifyInvoiceAdmin(tx.invoiceNumber)}
                              disabled={actionLoadingId === tx.invoiceNumber}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition"
                            >
                              Verifikasi &amp; Aktifkan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: LOG AKTIVITAS & AUDIT SISTEM
          ===================================================================== */}
      {adminTab === 'LOGS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">
                Log Aktivitas Sistem &amp; Keamanan (Prisma AuditLog)
              </h3>
              <p className="text-xs text-slate-400">
                Rekam jejak seluruh registrasi, persetujuan admin, upload KMZ, dan konversi Excel
              </p>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">Aksi</th>
                  <th className="py-2.5 px-4">Pengguna</th>
                  <th className="py-2.5 px-4">Detail Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-200 font-medium">
                      {log.user ? `${log.user.fullName} (@${log.user.username})` : 'Sistem'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px]">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL KONFIRMASI HAPUS AKUN PENGGUNA
          ===================================================================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteUserTarget)}
        type="USER"
        item={deleteUserTarget}
        confirmText="Ya, Hapus Akun Permanen"
        loading={deletingUser}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => {
          if (!deletingUser) setDeleteUserTarget(null);
        }}
      />

      {/* =====================================================================
          MODAL KONFIRMASI HAPUS CLUSTER DARI PANEL ADMIN
          ===================================================================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteClusterTarget)}
        type="PROJECT"
        item={deleteClusterTarget}
        confirmText="Ya, Hapus Cluster Permanen"
        loading={deletingCluster}
        onConfirm={handleConfirmDeleteCluster}
        onCancel={() => {
          if (!deletingCluster) setDeleteClusterTarget(null);
        }}
      />

      {/* =====================================================================
          MODAL TOLAK PENDAFTARAN AKUN (MENGGANTIKAN WINDOW.PROMPT)
          ===================================================================== */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
          onClick={() => {
            if (!rejectingUser) setRejectTarget(null);
          }}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Tolak Pendaftaran Akun</h3>
                  <p className="text-[11px] text-slate-400">
                    {rejectTarget.fullName} (@{rejectTarget.username})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={rejectingUser}
                onClick={() => setRejectTarget(null)}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Alasan Penolakan (Ditampilkan saat user mencoba login):
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Masukkan alasan penolakan..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={rejectingUser}
                  onClick={() => setRejectTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={rejectingUser}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {rejectingUser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      <span>Konfirmasi Tolak Akun</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
