import React, { useState } from 'react';
import {
  Network,
  ShieldCheck,
  UserPlus,
  LogIn,
  Lock,
  Mail,
  User,
  Building2,
  Phone,
  MapPin,
  BadgeCheck,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Map,
  Sparkles,
} from 'lucide-react';
import { apiFetch, setToken } from '../api';

export default function AuthPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regForm, setRegForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    employeeId: '',
    phone: '',
    department: 'SND FTTH Survey & Design',
    region: '',
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message);
      setErrorCode(err.code || '');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(regForm),
      });
      setSuccessMsg(res.message);
      setRegForm({
        fullName: '',
        username: '',
        email: '',
        password: '',
        employeeId: '',
        phone: '',
        department: 'SND FTTH Survey & Design',
        region: '',
      });
      setMode('login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillQuickCredentials = (type) => {
    setError('');
    setErrorCode('');
    setSuccessMsg('');
    setMode('login');
    if (type === 'admin') {
      setIdentifier('admin');
      setPassword('Admin123!');
    } else {
      setIdentifier('drafter');
      setPassword('Drafter123!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative overflow-hidden">
      {/* Subtle glowing fiber backdrop */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[32rem] h-[32rem] rounded-full bg-blue-600/10 blur-3xl" />

      {/* Left Column: Branding & Value Proposition */}
      <div className="lg:w-7/12 p-8 lg:p-14 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Network className="w-6 h-6 text-slate-950 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white">
                  FTTH SND <span className="text-cyan-400">PRO</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Enterprise v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Optical Distribution Network (ODN) KMZ Synchronization Platform
              </p>
            </div>
          </div>

          <div className="mt-12 lg:mt-16 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-xs text-cyan-300 mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Otomatisasi Sinkronisasi Desain AutoCAD & Google Earth KMZ</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              Konversi <span className="text-cyan-400">1-Klik KMZ</span> ke Format Standar{' '}
              <span className="text-emerald-400">Excel HPDB</span> &{' '}
              <span className="text-amber-400">BoQ</span>
            </h1>
            <p className="mt-4 text-slate-300 text-sm lg:text-base leading-relaxed">
              Dirancang khusus untuk mempercepat pekerjaan para Drafter Survey & Design (SND) FTTH.
              Tidak perlu lagi menyalin koordinat tiang, menghitung port FAT, memberi warna tube/core,
              atau menjumlahkan rute kabel & sling wire secara manual.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Sinkronisasi HPDB Presisi 100%</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Otomatis menyusun Fiber Core Assignment per FDT, warna Tube 1-4 (Biru, Oranye, Hijau,
                  Coklat), pencocokan Pole ID terdekat, serta 57 kolom standar HPDB.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2.5">
                  <Map className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Kalkulasi Otomatis BoM AE & BoQ</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Otomatis mengisi BoM AE & BoQ NRO Cluster lengkap dengan rumus Excel, rute kabel
                  24C/36C/48C, sling wire, tiang 7m/9m, aksesoris, hingga kode material SAP.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Security & Quick Access Box */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Akses terproteksi: Setiap pendaftaran Drafter baru wajib disetujui (Approved) oleh
              Administrator.
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Login & Registration Card */}
      <div className="lg:w-5/12 p-6 sm:p-10 lg:p-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setErrorCode('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setErrorCode('');
                setSuccessMsg('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Daftar Akun Drafter
            </button>
          </div>

          {/* Alerts */}
          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {error && (
            <div
              className={`mb-5 p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                errorCode === 'ACCOUNT_PENDING'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  errorCode === 'ACCOUNT_PENDING' ? 'text-amber-400' : 'text-rose-400'
                }`}
              />
              <div className="leading-relaxed">
                {errorCode === 'ACCOUNT_PENDING' && (
                  <div className="font-bold text-amber-300 mb-0.5">Menunggu Persetujuan Admin</div>
                )}
                {error}
              </div>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Username atau Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Masukkan username atau email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Memverifikasi Kredensial...' : 'Masuk ke Workspace SND'}
              </button>

              {/* Quick Credentials Helper */}
              <div className="pt-4 mt-4 border-t border-slate-800/80">
                <p className="text-[11px] font-medium text-slate-400 mb-2.5">
                  Akses Cepat Akun Terdaftar (Database Aktif):
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => fillQuickCredentials('admin')}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300">
                        Admin Utama
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        ADMIN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">user: admin</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillQuickCredentials('drafter')}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                        Drafter SND
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                        APPROVED
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">user: drafter</p>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Lengkap Drafter *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regForm.fullName}
                    onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={regForm.username}
                    onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                    placeholder="budi.snd"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ID Karyawan / NIK
                  </label>
                  <div className="relative">
                    <BadgeCheck className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regForm.employeeId}
                      onChange={(e) => setRegForm({ ...regForm, employeeId: e.target.value })}
                      placeholder="EMP-SND-..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Perusahaan / Pribadi *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="budi@perusahaan.co.id"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password (Min. 6 Karakter) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    placeholder="Minimal 6 karakter..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    No. Telepon / WA
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      placeholder="0812..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Region / Area Kerja
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regForm.region}
                      onChange={(e) => setRegForm({ ...regForm, region: e.target.value })}
                      placeholder="Sulawesi Utara / ..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Departemen / Divisi
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={regForm.department}
                    onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
                Catatan: Setelah mendaftar, status akun Anda adalah <b>PENDING</b>. Administrator
                harus melakukan <b>Approve</b> terlebih dahulu sebelum Anda bisa login.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Mengirim Pendaftaran...' : 'Kirim Pendaftaran Akun Drafter'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
