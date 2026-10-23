import React, { useState, useEffect } from 'react';
import {
  Globe,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  LogIn,
  UserPlus,
  Compass,
  Sparkles,
  Crown,
  Zap,
  QrCode,
  X,
  FileCode2
} from 'lucide-react';
import { apiFetch } from '../api';
import DwgConverterModal from './DwgConverterModal';
import KmzToDwgModal from './KmzToDwgModal';

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(num || 0));
}

export default function LandingPage({ onNavigateLogin, onNavigateRegister }) {
  const [dwgModalOpen, setDwgModalOpen] = useState(false);
  const [kmzToDwgModalOpen, setKmzToDwgModalOpen] = useState(false);
  const [plans, setPlans] = useState([
    {
      code: 'BASIC',
      name: 'Paket BASIC',
      badge: 'Starter SND',
      price: 20000,
      monthlyLimit: 10,
      boqAllowed: false,
      description:
        'Maksimal 10x Convert KMZ / bulan (Hanya Excel HPDB & Peta GIS, BoQ tidak termasuk)',
      features: [
        'Kuota 10x Convert KMZ / KML per Bulan',
        'Export & Preview Tabel Excel HPDB.xlsx (58 Kolom)',
        'Visualisasi Peta Topologi GIS Interaktif',
        'Tidak termasuk Export & Tabel BoQ.xlsx'
      ]
    },
    {
      code: 'PRO',
      name: 'Paket PRO',
      badge: 'Paling Populer',
      price: 50000,
      monthlyLimit: 30,
      boqAllowed: true,
      description: 'Maksimal 30x Convert KMZ / bulan (Lengkap HPDB.xlsx + BOQ.xlsx + Peta GIS)',
      features: [
        'Kuota 30x Convert KMZ / KML per Bulan',
        'Export & Preview Tabel Excel HPDB.xlsx (58 Kolom)',
        'Termasuk Export & Preview Excel BOQ.xlsx Lengkap',
        'Visualisasi Peta Topologi GIS Interaktif'
      ]
    },
    {
      code: 'ULTRA',
      name: 'Paket ULTRA',
      badge: 'Unlimited Enterprise',
      price: 150000,
      monthlyLimit: -1,
      boqAllowed: true,
      description:
        'UNLIMITED Convert KMZ / bulan tanpa batas + Akses penuh HPDB.xlsx, BOQ.xlsx & Peta GIS',
      features: [
        'UNLIMITED Convert KMZ / KML per Bulan (Tanpa Batas)',
        'Export & Preview Tabel Excel HPDB.xlsx (58 Kolom)',
        'Termasuk Export & Preview Excel BOQ.xlsx Lengkap',
        'Prioritas Pemrosesan & Penyimpanan Cluster'
      ]
    }
  ]);

  useEffect(() => {
    apiFetch('/payments/public-config')
      .then((res) => {
        if (res?.plans?.length) {
          setPlans(res.plans);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectPlan = (planCode) => {
    try {
      localStorage.setItem('ftth_selected_plan', planCode);
    } catch {
      // ignore
    }
    onNavigateRegister();
  };

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#02050c] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white overflow-x-hidden relative">
      {/* =====================================================================
          HERO COVER SECTION WITH CINEMATIC EARTH FROM SPACE BACKGROUND
          ===================================================================== */}
      <div className="relative min-h-screen flex flex-col justify-between overflow-hidden">
        {/* Background Layer 1: High-Res Earth from Space Night City Lights Image */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src="/earth-bg.png"
            alt="Earth from Space FTTH Network Horizon"
            className="w-full h-full object-cover object-center animate-earth-cover"
          />

          {/* Atmospheric Horizon Glow Pulse */}
          <div
            className="absolute inset-0 animate-atmosphere"
            style={{
              background:
                'radial-gradient(circle at 62% 52%, rgba(56, 189, 248, 0.22) 0%, rgba(14, 165, 233, 0.08) 38%, transparent 70%)'
            }}
          />

          {/* Subtle Animated Fiber-Optic Orbital Light Arcs over the Earth Curvature */}
          <svg
            viewBox="0 0 1920 1080"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full object-cover opacity-75"
            preserveAspectRatio="xMidYMid slice"
          >
            <path
              d="M 480 820 Q 860 540 1320 670"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-orbit-arc"
            />
            <path
              d="M 690 740 Q 1080 490 1560 640"
              stroke="#34d399"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="animate-orbit-arc-delayed"
            />
            <path
              d="M 320 910 Q 790 640 1190 790"
              stroke="#fbbf24"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="animate-orbit-arc"
            />

            {[
              [480, 820, '#38bdf8'],
              [1320, 670, '#38bdf8'],
              [690, 740, '#34d399'],
              [1560, 640, '#34d399'],
              [980, 690, '#fbbf24'],
              [1190, 790, '#fbbf24'],
              [310, 210, '#e0f2fe'],
              [820, 140, '#bae6fd'],
              [1420, 190, '#e0f2fe'],
              [1680, 280, '#bae6fd']
            ].map(([cx, cy, color], idx) => (
              <g key={idx}>
                <circle
                  cx={cx}
                  cy={cy}
                  r="6"
                  fill={color}
                  fillOpacity="0.25"
                  className="animate-star-twinkle"
                  style={{ animationDelay: `${idx * 0.4}s` }}
                />
                <circle cx={cx} cy={cy} r="2.2" fill={color} />
              </g>
            ))}
          </svg>

          <div className="absolute inset-0 bg-gradient-to-r from-[#02050c]/85 via-[#02050c]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#02050c] via-transparent to-[#02050c]/60" />
        </div>

        {/* Top Navigation Bar (Fixed on Scroll) */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#02050c]/85 backdrop-blur-2xl border-b border-white/10 shadow-xl shadow-black/40">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
            {/* Left: Brand Logo & Identity */}
            <div
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3.5 group cursor-pointer shrink-0"
            >
              <div className="w-12 h-12 p-1 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/90 group-hover:scale-105 transition-transform duration-300 shrink-0">
                <img
                  src="/logo-icon.png"
                  alt="FTTH SND GeoStudio Emblem"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-white">
                    FTTH SND{' '}
                    <span className="text-cyan-400">Geo</span>
                    <span className="text-[#d6b772]">Studio</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-md bg-white/10 text-[#d6b772] border border-[#d6b772]/35">
                    by TOSKA
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  AutoCAD &amp; Google Earth KMZ to Excel Synchronizer
                </p>
              </div>
            </div>

            {/* Center: Modern Glass Pill Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 p-1.5 rounded-full bg-slate-900/85 border border-slate-800/90 backdrop-blur-xl shadow-lg">
              <button
                type="button"
                onClick={() => setKmzToDwgModalOpen(true)}
                className="whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border border-emerald-400/50 text-emerald-300 hover:text-white hover:border-emerald-300 text-xs font-extrabold transition shadow-sm"
              >
                <FileCode2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>KMZ ke DWG</span>
                <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-emerald-400 text-slate-950 font-black uppercase">BARU</span>
              </button>
              <button
                type="button"
                onClick={() => setDwgModalOpen(true)}
                className="whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-cyan-500/25 to-blue-500/25 border border-cyan-400/50 text-cyan-300 hover:text-white hover:border-cyan-300 text-xs font-extrabold transition shadow-sm"
              >
                <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>DWG ke KMZ</span>
              </button>
              <a
                href="#pricing"
                onClick={(e) => scrollToSection(e, 'pricing')}
                className="whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-slate-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Paket Harga</span>
              </a>
              <a
                href="#alur-kerja"
                onClick={(e) => scrollToSection(e, 'alur-kerja')}
                className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition"
              >
                Alur Otomasi
              </a>
              <a
                href="#standar-excel"
                onClick={(e) => scrollToSection(e, 'standar-excel')}
                className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition"
              >
                Standar HPDB &amp; BoQ
              </a>
              <a
                href="#keamanan"
                onClick={(e) => scrollToSection(e, 'keamanan')}
                className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition"
              >
                Aktivasi Otomatis
              </a>
            </nav>

            {/* Right: Auth CTA Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={onNavigateLogin}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-cyan-400/50 text-xs font-bold transition shadow-sm"
              >
                <LogIn className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Masuk</span>
              </button>
              <button
                onClick={onNavigateRegister}
                className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold shadow-lg shadow-cyan-500/25 transition"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Daftar Drafter</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Hero Cover Content */}
        <div className="relative z-20 flex-1 flex items-center px-6 pt-32 pb-16 lg:pt-36 lg:pb-24">
          <div className="max-w-7xl mx-auto w-full">
            <div className="max-w-3xl space-y-6">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-950/75 backdrop-blur-md border border-cyan-400/40 text-cyan-300 text-xs font-semibold shadow-lg">
                <Globe className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '12s' }} />
                <span>Integrasi Langsung Google Earth (.KMZ) &amp; AutoCAD Design</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
                Ubah Peta Desain{' '}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-400 bg-clip-text text-transparent animate-text-shimmer">
                  Google Earth KMZ
                </span>{' '}
                Menjadi Excel{' '}
                <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                  HPDB &amp; BoQ
                </span>{' '}
                Secara Otomatis.
              </h1>

              <p className="text-base sm:text-lg text-slate-200/95 leading-relaxed max-w-xl drop-shadow">
                Dirancang khusus untuk mempercepat pekerjaan para <strong>Drafter FTTH (SND)</strong>.
              </p>

              {/* Primary CTA Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-3">
                <button
                  onClick={onNavigateLogin}
                  className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-sm shadow-2xl shadow-cyan-500/35 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk &amp; Konversi KMZ Sekarang</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </button>

                <button
                  onClick={(e) => scrollToSection(e, 'pricing')}
                  className="flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-slate-950/75 hover:bg-slate-900/90 backdrop-blur-md border border-cyan-400/40 hover:border-cyan-400 text-cyan-200 font-bold text-sm transition-all shadow-xl"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Lihat Paket Harga</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKmzToDwgModalOpen(true)}
                  className="flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-900/60 to-teal-900/60 hover:from-emerald-800/80 hover:to-teal-800/80 backdrop-blur-md border border-emerald-400/50 hover:border-emerald-300 text-white font-extrabold text-sm transition-all shadow-xl shadow-emerald-500/20 cursor-pointer"
                >
                  <FileCode2 className="w-4 h-4 text-emerald-400" />
                  <span>Convert KMZ ke DWG (.dwg)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDwgModalOpen(true)}
                  className="flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-900/60 to-cyan-900/60 hover:from-blue-800/80 hover:to-cyan-800/80 backdrop-blur-md border border-cyan-400/50 hover:border-cyan-300 text-white font-extrabold text-sm transition-all shadow-xl shadow-cyan-500/20 cursor-pointer"
                >
                  <FileCode2 className="w-4 h-4 text-cyan-400" />
                  <span>Coba Konvert DWG (.dwg)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION: PRICING / PAKET LANGGANAN BULANAN DRAFTER SND
          ===================================================================== */}
      <section
        id="pricing"
        className="scroll-mt-20 relative z-10 py-24 px-6 bg-gradient-to-b from-[#02050c] via-[#040b1a] to-[#030814] border-t border-slate-800/80"
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#118EEA]/15 border border-[#118EEA]/40 text-cyan-300 text-xs font-extrabold uppercase tracking-wider">
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Pricing &amp; Paket Langganan Bulanan</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Pilih Paket Sesuai Kebutuhan Proyek FTTH Anda
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Pembayaran otomatis menggunakan <strong>QRIS DANA Bisnis</strong> — Akun dan kuota convert Anda langsung aktif detik itu juga setelah pembayaran terverifikasi!
            </p>
          </div>

          {/* 3 Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
            {plans.map((p) => {
              const isPopular = p.code === 'PRO';
              const isUltra = p.code === 'ULTRA';
              const IconComp = isUltra ? Crown : isPopular ? Sparkles : Zap;

              return (
                <div
                  key={p.code}
                  className={`relative rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 ${
                    isPopular
                      ? 'bg-gradient-to-b from-cyan-950/60 via-slate-900/95 to-slate-950 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/20 lg:-translate-y-2'
                      : isUltra
                      ? 'bg-gradient-to-b from-purple-950/40 via-slate-900/95 to-slate-950 border border-purple-500/40 hover:border-purple-400 shadow-xl'
                      : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-xl'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 text-[11px] font-black uppercase tracking-wider shadow-lg">
                      ★ Paling Banyak Dipilih Drafter
                    </div>
                  )}

                  <div>
                    {/* Top Badge & Quota Pill */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                          isUltra
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : isPopular
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{p.badge}</span>
                      </span>

                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        {p.monthlyLimit === -1 ? '∞ Unlimited' : `${p.monthlyLimit}x Convert / Bln`}
                      </span>
                    </div>

                    {/* Plan Name & Price */}
                    <h3 className="text-xl font-extrabold text-white">{p.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span
                        className={`text-3xl sm:text-4xl font-black tracking-tight ${
                          isUltra
                            ? 'text-purple-300'
                            : isPopular
                            ? 'text-cyan-300'
                            : 'text-white'
                        }`}
                      >
                        {formatRupiah(p.price)}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">/ bulan (30 hari)</span>
                    </div>

                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      {p.description}
                    </p>

                    {/* Features List */}
                    <div className="mt-6 pt-5 border-t border-slate-800/90 space-y-3">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Fitur yang Didapatkan:
                      </div>
                      <ul className="space-y-2.5">
                        {(p.features || []).map((feat, i) => {
                          const isExcluded = feat.toLowerCase().includes('tidak termasuk');
                          return (
                            <li
                              key={i}
                              className={`flex items-start gap-2.5 text-xs ${
                                isExcluded ? 'text-slate-500' : 'text-slate-200'
                              }`}
                            >
                              {isExcluded ? (
                                <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              )}
                              <span>{feat}</span>
                            </li>
                          );
                        })}
                        <li className="flex items-start gap-2.5 text-xs text-slate-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>Aktivasi Instan Otomatis via QRIS DANA Bisnis</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <div className="mt-8 pt-4">
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(p.code)}
                      className={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
                        isPopular
                          ? 'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
                          : isUltra
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/25'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      }`}
                    >
                      <span>Pilih {p.name} &amp; Daftar</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION: 3 LANGKAH OTOMASI DRAFTER FTTH SND
          ===================================================================== */}
      <section id="alur-kerja" className="scroll-mt-20 relative z-10 py-20 bg-[#030814] border-y border-slate-800/80 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-bold uppercase tracking-widest text-cyan-400">
              <Compass className="w-3.5 h-3.5" />
              <span>Workflow Otomasi Geospasial</span>
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-3">
              Bagaimana Website Ini Mempercepat Kerja Drafter SND?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Dirancang presisi mengikuti struktur layer AutoCAD &amp; Google Earth KMZ standar proyek FTTH.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-extrabold text-base mb-4 group-hover:scale-110 transition-transform">
                01
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                1. Upload File Desain .KMZ / .KML
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Setelah selesai mendesain jalur kabel, tiang, FAT, dan Homepass di AutoCAD &amp; Google Earth, cukup upload file <code className="text-cyan-300 font-mono">.kmz</code> Anda. Parser otomatis mengekstrak seluruh folder <code className="text-cyan-300 font-mono">FDT</code>, <code className="text-cyan-300 font-mono">Line A/B/C/D</code>, <code className="text-cyan-300 font-mono">FAT</code>, <code className="text-cyan-300 font-mono">HP COVER</code>, dan <code className="text-cyan-300 font-mono">POLE</code>.
              </p>
            </div>

            <div className="group p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-base mb-4 group-hover:scale-110 transition-transform">
                02
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                2. Auto-Snap Pole &amp; Deteksi Kabel 24C/36C/48C
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Mesin geospasial otomatis mencocokkan koordinat setiap FAT ke tiang terdekat (<code className="text-emerald-300 font-mono">Pole ID</code>), menyesuaikan tipe kabel distribusi per Line (<code className="text-emerald-300 font-mono">24C/2T, 36C/3T, 48C/4T</code>), serta menjumlahkan rute kabel FO &amp; Sling Wire per FDT.
              </p>
            </div>

            <div className="group p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-base mb-4 group-hover:scale-110 transition-transform">
                03
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                3. Download Excel HPDB &amp; BoQ 1-Klik
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Preview langsung di layar dengan tampilan spreadsheet yang sama persis dengan Excel, lalu klik tombol <strong className="text-emerald-400">Download HPDB.xlsx</strong> dan <strong className="text-amber-400">Download BOQ.xlsx</strong>. Lengkap dengan rumus Excel aktif &amp; kode SAP!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION: STANDAR OUTPUT EXCEL (HPDB & BOQ)
          ===================================================================== */}
      <section id="standar-excel" className="scroll-mt-20 relative z-10 py-20 px-6 bg-[#02050c]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              100% Presisi Sesuai Contoh
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">
              Output Excel Identik dengan <code className="text-emerald-400">CONTOH HPDB.xlsx</code> &amp; <code className="text-amber-400">CONTOH BOQ.xlsx</code>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Card HPDB */}
            <div className="p-7 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-bold">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Standar Output 1: HPDB.xlsx</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Homepass Database (58 Kolom A s/d BF per Sheet FDT)
              </h3>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Warna Baris Tube 1–4 Otomatis:</strong> Tube 1 Biru (<code className="text-cyan-300">#0070C0</code>), Tube 2 Oranye (<code className="text-amber-300">#FFC000</code>), Tube 3 Hijau (<code className="text-emerald-300">#92D050</code>), dan Tube 4 Coklat (<code className="text-amber-500">#806000</code>).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Multi-FDT Otomatis:</strong> Jika KMZ memiliki FDT 1 dan FDT 2, file Excel otomatis membuat sheet terpisah (<code className="text-emerald-300">FDT 1</code>, <code className="text-emerald-300">FDT 2</code>) lengkap dengan kapasitas kabel per Line.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rumus Kolom BF &amp; Header FDT:</strong> Menyertakan tabel ringkasan FDT di baris 1–7 serta rumus otomatis <code className="text-emerald-300">=AK9&amp;&quot;, &quot;&amp;AE9&amp;&quot;,&quot;&amp;AJ9</code> di kolom BF.
                  </span>
                </li>
              </ul>
            </div>

            {/* Card BoQ */}
            <div className="p-7 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-bold">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Standar Output 2: BOQ.xlsx (Paket PRO &amp; ULTRA)</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                BoQ NRO Cluster, BoM AE, All Feeder &amp; Summary Permit
              </h3>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Populasi Otomatis Sheet BoM AE:</strong> Mengisi kuantitas per FDT (<code className="text-amber-300">FDT-1</code> s/d <code className="text-amber-300">FDT-5</code>) untuk rute kabel distribusi, Sling Wire, jumlah FAT, Tiang Baru, dan Tiang Existing EMR.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Sinkronisasi Penuh Sheet BoQ NRO Cluster:</strong> Seluruh 339 baris item SAP Material &amp; Jasa terhubung dengan rumus aktif ke lembar kerja <code className="text-amber-300">BoM AE</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Kalkulasi Presisi Aksesoris Tiang:</strong> <code className="text-amber-300">Pole Clamp</code>, <code className="text-amber-300">Stopping Buckle</code>, <code className="text-amber-300">Stainless Steel Strip</code>, dan <code className="text-amber-300">Strand/Guy Wire</code> dihitung tepat hingga desimal.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION: AKTIVASI OTOMATIS QRIS DANA BISNIS CTA
          ===================================================================== */}
      <section id="keamanan" className="scroll-mt-20 relative z-10 py-16 px-6 bg-[#02050c]">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/60 border border-slate-800 p-8 sm:p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#118EEA]/20 border border-[#118EEA]/40 text-cyan-300 text-xs font-bold">
              <QrCode className="w-4 h-4" />
              <span>Aktivasi Otomatis via QRIS DANA Bisnis</span>
            </div>
            <h3 className="text-2xl font-extrabold text-white">
              Siap Mempercepat Progress Proyek FTTH SND Anda?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Pilih paket langganan bulanan Anda (<strong>Basic</strong>, <strong>Pro</strong>, atau <strong>Ultra</strong>), lakukan scan pembayaran pada <strong>Barcode QRIS DANA Bisnis</strong>, dan akun Anda akan <strong>langsung aktif otomatis</strong> tanpa perlu menunggu lama!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={onNavigateRegister}
              className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Daftar &amp; Pilih Paket Sekarang</span>
            </button>
            <button
              onClick={onNavigateLogin}
              className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs transition"
            >
              <LogIn className="w-4 h-4 text-cyan-400" />
              <span>Sudah Punya Akun? Login</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-slate-900 bg-[#010308] py-8 px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-icon.png"
              alt="FTTH SND GeoStudio"
              className="w-7 h-7 object-contain rounded-lg bg-white p-0.5 shadow-sm"
            />
            <span className="font-extrabold text-white">
              FTTH SND <span className="text-cyan-400">Geo</span>
              <span className="text-[#d6b772]">Studio</span>
            </span>
            <span className="text-slate-500">— Google Earth KMZ to Excel HPDB &amp; BoQ Synchronization Platform</span>
          </div>
          <div className="font-medium text-slate-400">copyright TOSKA @ 2026 - design by Ndoo-</div>
        </div>
      </footer>

      {/* DWG to KMZ Converter Modal on Landing Page */}
      <DwgConverterModal
        isOpen={dwgModalOpen}
        onClose={() => setDwgModalOpen(false)}
        onProjectCreated={() => {
          setDwgModalOpen(false);
          onNavigateLogin();
        }}
      />

      {/* KMZ to DWG Converter Modal on Landing Page */}
      <KmzToDwgModal
        isOpen={kmzToDwgModalOpen}
        onClose={() => setKmzToDwgModalOpen(false)}
      />
    </div>
  );
}
