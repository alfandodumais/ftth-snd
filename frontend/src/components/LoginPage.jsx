import React, { useState } from 'react';
import {
  Network,
  LogIn,
  Lock,
  User,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  QrCode
} from 'lucide-react';
import { apiFetch, setToken } from '../api';
import DanaPaymentModal from './DanaPaymentModal';

export default function LoginPage({
  onLoginSuccess,
  onNavigateLanding,
  onNavigateRegister,
  initialMessage = ''
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [merchantInfo, setMerchantInfo] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      setToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message);
      setErrorCode(err.code || '');
      if (err.code === 'PAYMENT_REQUIRED') {
        if (err.invoice) setPendingInvoice(err.invoice);
        if (err.merchant) setMerchantInfo(err.merchant);
        if (err.user) setPendingUser(err.user);
        setPaymentModalOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (payData) => {
    setPaymentModalOpen(false);
    if (payData?.token && payData?.user) {
      setToken(payData.token);
      onLoginSuccess(payData.user);
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
          onClick={onNavigateRegister}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-xs font-bold transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Belum Punya Akun? Daftar &amp; Pilih Paket</span>
        </button>
      </header>

      {/* Center Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-20 h-20 rounded-3xl bg-white ring-2 ring-cyan-400/50 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-cyan-500/20 p-2">
              <img
                src="/logo-icon.png"
                alt="FTTH SND GeoStudio Emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#081c37] border border-[#d6b772]/40 text-[#d6b772] text-[10px] font-bold tracking-wider mb-2">
              FTTH SND GeoStudio • by TOSKA
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Masuk ke{' '}
              <span className="text-cyan-400">Geo</span>
              <span className="text-[#d6b772]">Studio</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1.5">
              Gunakan akun Drafter SND berlangganan aktif atau Administrator
            </p>
          </div>

          {initialMessage && !error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{initialMessage}</span>
            </div>
          )}

          {error && (
            <div
              className={`mb-5 p-4 rounded-2xl border flex flex-col gap-3 text-xs ${
                errorCode === 'PAYMENT_REQUIRED' || errorCode === 'ACCOUNT_PENDING'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-red-500/10 border-red-500/40 text-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    errorCode === 'PAYMENT_REQUIRED' || errorCode === 'ACCOUNT_PENDING'
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                />
                <div>
                  <div className="font-bold mb-0.5">
                    {errorCode === 'PAYMENT_REQUIRED'
                      ? 'Menunggu Pembayaran Paket Langganan'
                      : errorCode === 'ACCOUNT_PENDING'
                      ? 'Menunggu Aktivasi Akun'
                      : 'Gagal Masuk'}
                  </div>
                  <div className="leading-relaxed">{error}</div>
                </div>
              </div>

              {errorCode === 'PAYMENT_REQUIRED' && (
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#118EEA] to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Buka Barcode QRIS DANA Bisnis &amp; Aktifkan Sekarang</span>
                </button>
              )}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username atau Email Kerja
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Contoh: drafter atau admin@ftth-snd.id"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Memverifikasi Kredensial...' : 'Masuk ke Dashboard SND'}</span>
            </button>
          </form>

          {/* Link to Register Page */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
            Belum memiliki akun Drafter SND?{' '}
            <button
              type="button"
              onClick={onNavigateRegister}
              className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
            >
              Daftar &amp; Pilih Paket Langganan
            </button>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-[11px] text-slate-400">
        copyright TOSKA @ 2026 - design by Ndoo-
      </footer>

      {/* Modal Payment Gateway DANA Bisnis */}
      <DanaPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        initialInvoice={pendingInvoice}
        initialMerchant={merchantInfo}
        user={pendingUser}
        defaultPlanCode={pendingUser?.subscriptionPlan || 'PRO'}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
