import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  ArrowLeft,
  User,
  Mail,
  Lock,
  Phone,
  BadgeCheck,
  AlertCircle,
  CheckCircle2,
  LogIn,
  QrCode,
  Sparkles,
  Crown,
  Zap,
  Check,
  X
} from 'lucide-react';
import { apiFetch, setToken } from '../api';
import DanaPaymentModal from './DanaPaymentModal';

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(num || 0));
}

export default function RegisterPage({ onNavigateLanding, onNavigateLogin, onLoginSuccess }) {
  const [regForm, setRegForm] = useState(() => {
    let savedPlan = 'PRO';
    try {
      const fromStorage = localStorage.getItem('ftth_selected_plan');
      if (['BASIC', 'PRO', 'ULTRA'].includes(fromStorage)) {
        savedPlan = fromStorage;
      }
    } catch {
      // ignore
    }
    return {
      fullName: '',
      username: '',
      email: '',
      password: '',
      phone: '',
      planCode: savedPlan
    };
  });

  const [plans, setPlans] = useState([
    {
      code: 'BASIC',
      name: 'Paket Basic',
      price: 100000,
      monthlyConvertLimit: 10,
      boqAccessAllowed: false,
      badge: 'Starter',
      features: [
        'Kuota 10x Convert KMZ / Bulan',
        'Auto-Generate HPDB Lengkap (.xlsx)',
        'Visualisasi Peta Topologi & Kabel',
        'BoQ Tidak Termasuk (Terkunci)'
      ]
    },
    {
      code: 'PRO',
      name: 'Paket Pro',
      price: 250000,
      monthlyConvertLimit: 30,
      boqAccessAllowed: true,
      badge: 'Paling Populer',
      features: [
        'Kuota 30x Convert KMZ / Bulan',
        'Auto-Generate HPDB Lengkap (.xlsx)',
        'Full Akses & Export BoQ Standar (.xlsx)',
        'Visualisasi Peta Topologi & Kabel'
      ]
    },
    {
      code: 'ULTRA',
      name: 'Paket Ultra',
      price: 500000,
      monthlyConvertLimit: -1,
      boqAccessAllowed: true,
      badge: 'Unlimited',
      features: [
        'UNLIMITED Convert KMZ / Bulan',
        'Auto-Generate HPDB Lengkap (.xlsx)',
        'Full Akses & Export BoQ Standar (.xlsx)',
        'Prioritas Pemrosesan Cluster Besar'
      ]
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedUser, setSubmittedUser] = useState(null);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [merchantInfo, setMerchantInfo] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    apiFetch('/payments/public-config')
      .then((res) => {
        if (res?.plans?.length) setPlans(res.plans);
        if (res?.merchant) setMerchantInfo(res.merchant);
      })
      .catch(() => {});
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(regForm)
      });
      setSubmittedUser(res.user);
      if (res.invoice) setActiveInvoice(res.invoice);
      if (res.merchant) setMerchantInfo(res.merchant);
      setPaymentModalOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (payData) => {
    setPaymentModalOpen(false);
    if (payData?.token && payData?.user && onLoginSuccess) {
      setToken(payData.token);
      onLoginSuccess(payData.user);
    } else {
      onNavigateLogin('Pembayaran DANA Bisnis terverifikasi! Akun Anda telah aktif otomatis, silakan masuk.');
    }
  };

  return (
    <div className="min-h-screen bg-[#02050c] text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Earth from Space Background Cover */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/earth-bg.png"
          alt="Earth Background"
          className="w-full h-full object-cover object-center animate-earth-cover opacity-65"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#02050c]/75 via-[#02050c]/60 to-[#02050c]/90" />
      </div>

      {/* Top Bar */}
      <header className="relative z-20 max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateLanding}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
          <span>Kembali ke Beranda</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateLogin('')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition"
        >
          <LogIn className="w-4 h-4 text-cyan-400" />
          <span>Sudah Punya Akun? Masuk (Login)</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-4xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {submittedUser ? (
            /* Registration Submitted -> Waiting for DANA Bisnis QRIS Payment */
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-[#118EEA]/20 border border-[#118EEA]/40 flex items-center justify-center mx-auto text-cyan-400">
                <QrCode className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold border border-amber-500/30">
                  MENUNGGU PEMBAYARAN PAKET ({regForm.planCode})
                </span>
                <h2 className="text-2xl font-extrabold text-white">
                  Satu Langkah Lagi: Selesaikan Pembayaran DANA Bisnis
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  Akun Drafter <strong className="text-white">@{submittedUser.username}</strong> telah terdaftar.
                  Silakan scan <strong className="text-cyan-300">Barcode QRIS DANA Bisnis</strong> untuk mengaktifkan akun dan kuota convert Anda secara otomatis!
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-w-md mx-auto text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Nama Drafter:</span>
                  <span className="font-bold text-white">{submittedUser.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Username:</span>
                  <span className="font-mono text-cyan-300">@{submittedUser.username}</span>
                </div>
                {activeInvoice && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Paket Dipilih:</span>
                      <span className="font-bold text-emerald-300">{activeInvoice.planName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Tagihan (Kode Unik):</span>
                      <span className="font-extrabold text-amber-300 font-mono">
                        {formatRupiah(activeInvoice.totalAmount)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#118EEA] to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 transition"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Buka Barcode QRIS DANA Bisnis &amp; Aktifkan Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateLogin('')}
                  className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                >
                  Ke Halaman Login
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Registration Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 p-1.5 rounded-2xl bg-white ring-2 ring-cyan-400/50 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                    <img
                      src="/logo-icon.png"
                      alt="FTTH SND GeoStudio Emblem"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-extrabold tracking-wider text-cyan-400">
                        FTTH SND GeoStudio
                      </span>
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-[#081c37] text-[#d6b772] border border-[#d6b772]/40">
                        by TOSKA
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      Registrasi Drafter &amp; Pilih Paket Langganan
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pilih paket convert KMZ bulanan Anda — Aktivasi instan otomatis via QRIS DANA Bisnis
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#118EEA]/15 border border-[#118EEA]/40 text-cyan-300 text-[11px] font-bold shrink-0">
                  <QrCode className="w-4 h-4" />
                  <span>Auto-Active QRIS DANA Bisnis</span>
                </div>
              </div>

              {error && (
                <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-6">
                {/* Step 1: Pilih Paket Langganan */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                      1. Pilih Paket Langganan Bulanan (30 Hari) *
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Langsung aktif otomatis setelah pembayaran
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {plans.map((p) => {
                      const isSelected = regForm.planCode === p.code;
                      const IconComp = p.code === 'ULTRA' ? Crown : p.code === 'PRO' ? Sparkles : Zap;
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => setRegForm({ ...regForm, planCode: p.code })}
                          className={`text-left p-4 rounded-2xl border transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-gradient-to-b from-blue-950/70 to-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400/50'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                  p.code === 'ULTRA'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : p.code === 'PRO'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                <IconComp className="w-3 h-3" />
                                {p.badge}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                                    : 'border-slate-600'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>

                            <div className="text-sm font-extrabold text-white">{p.name}</div>
                            <div className="mt-1 flex items-baseline gap-1">
                              <span className="text-lg font-black text-cyan-300">
                                {formatRupiah(p.price)}
                              </span>
                              <span className="text-[10px] text-slate-400">/ bulan</span>
                            </div>

                            <ul className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-2.5">
                              {p.features?.map((f, i) => {
                                const isLocked = f.toLowerCase().includes('tidak termasuk');
                                return (
                                  <li
                                    key={i}
                                    className={`flex items-start gap-1.5 text-[11px] ${
                                      isLocked ? 'text-slate-500' : 'text-slate-300'
                                    }`}
                                  >
                                    {isLocked ? (
                                      <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    )}
                                    <span>{f}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Data Profil Drafter */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-cyan-400 mb-3">
                    2. Lengkapi Data Akun Drafter SND *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Nama Lengkap Drafter *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={regForm.fullName}
                          onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                          placeholder="Contoh: Budi Santoso"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Username *
                      </label>
                      <div className="relative">
                        <BadgeCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={regForm.username}
                          onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                          placeholder="Contoh: budi_snd"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Email Kerja *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={regForm.email}
                          onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                          placeholder="budi@ftth-snd.id"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Password (Min. 6 Karakter) *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={regForm.password}
                          onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                          placeholder="Minimal 6 karakter"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        No. Telepon / WhatsApp
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={regForm.phone}
                          onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                          placeholder="Contoh: 081234567890"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#118EEA] via-cyan-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {loading
                      ? 'Membuat Tagihan QRIS DANA Bisnis...'
                      : `Daftar & Lanjut Bayar Paket ${regForm.planCode} (QRIS DANA Bisnis)`}
                  </span>
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
                Sudah memiliki akun Drafter yang aktif?{' '}
                <button
                  type="button"
                  onClick={() => onNavigateLogin('')}
                  className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
                >
                  Masuk di Halaman Login
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-[11px] text-slate-400">
        copyright TOSKA @ 2026 - design by Ndoo-
      </footer>

      {/* Modal Payment Gateway DANA Bisnis */}
      <DanaPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        initialInvoice={activeInvoice}
        initialMerchant={merchantInfo}
        user={submittedUser}
        defaultPlanCode={regForm.planCode}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
