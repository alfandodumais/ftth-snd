import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  Zap,
  X,
  QrCode,
  Lock,
  ArrowRight,
  AlertCircle,
  Radio,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { apiFetch, setToken } from '../api';

export default function DanaPaymentModal({
  isOpen,
  onClose,
  initialInvoice,
  initialMerchant,
  user,
  userId,
  defaultPlanCode,
  currentPlan = 'NONE',
  onPaymentSuccess
}) {
  const effectiveUserId = user?.id || userId || initialInvoice?.userId;
  const initialPlan =
    initialInvoice?.planCode ||
    defaultPlanCode ||
    (currentPlan !== 'NONE'
      ? currentPlan
      : user?.subscriptionPlan !== 'NONE'
      ? user?.subscriptionPlan
      : 'PRO') ||
    'PRO';

  const [invoice, setInvoice] = useState(initialInvoice || null);
  const [merchant, setMerchant] = useState(
    initialMerchant || {
      merchantName: 'TOSKA FTTH SND - DANA BISNIS',
      merchantNmid: 'ID1026000088991',
      danaPhoneNumber: '0812-3456-7890',
      qrisImageUrl: null,
      autoVerifyMode: true
    }
  );
  const [plans, setPlans] = useState([
    {
      code: 'BASIC',
      name: 'Paket BASIC',
      badge: 'Starter SND',
      price: 20000,
      monthlyLimit: 10,
      boqAllowed: false,
      features: [
        'Kuota 10x Convert KMZ / Bulan',
        'Export & Tabel Excel HPDB.xlsx (58 Kolom)',
        'Visualisasi Peta Topologi GIS',
        'Tidak termasuk BoQ.xlsx'
      ]
    },
    {
      code: 'PRO',
      name: 'Paket PRO',
      badge: 'Paling Populer',
      price: 50000,
      monthlyLimit: 30,
      boqAllowed: true,
      features: [
        'Kuota 30x Convert KMZ / Bulan',
        'Export & Tabel Excel HPDB.xlsx (58 Kolom)',
        'Termasuk Export & Tabel BOQ.xlsx Lengkap',
        'Visualisasi Peta Topologi GIS'
      ]
    },
    {
      code: 'ULTRA',
      name: 'Paket ULTRA',
      badge: 'Unlimited',
      price: 150000,
      monthlyLimit: -1,
      boqAllowed: true,
      features: [
        'UNLIMITED Convert KMZ / Bulan (Tanpa Batas)',
        'Export & Tabel Excel HPDB.xlsx (58 Kolom)',
        'Termasuk Export & Tabel BOQ.xlsx Lengkap',
        'Prioritas Pemrosesan & Server'
      ]
    }
  ]);

  const [selectedPlanCode, setSelectedPlanCode] = useState(initialPlan);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Receipt image & RRN for automatic OCR verification
  const [receiptPreview, setReceiptPreview] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [rrnCode, setRrnCode] = useState('');
  const receiptInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setPaidSuccess(false);
    setErrorMsg('');
    if (initialInvoice) {
      setInvoice(initialInvoice);
      setSelectedPlanCode(initialInvoice.planCode);
    }
    if (initialMerchant) {
      setMerchant(initialMerchant);
    }

    // Load latest public config (prices & Admin's DANA Bisnis QRIS image)
    apiFetch('/payments/public-config')
      .then((data) => {
        if (data?.merchant) setMerchant(data.merchant);
        if (Array.isArray(data?.plans) && data.plans.length > 0) setPlans(data.plans);
      })
      .catch(() => {});
  }, [isOpen, initialInvoice, initialMerchant]);

  // If opened from Dashboard without an initialInvoice, automatically create one for selectedPlanCode
  useEffect(() => {
    if (!isOpen) return;
    if (!initialInvoice && effectiveUserId && !loadingInvoice) {
      handleSelectPlan(defaultPlanCode || selectedPlanCode);
    }
  }, [isOpen, effectiveUserId]);

  // Poll invoice status every 3.5 seconds in case DANA Bisnis Webhook or Admin marks it PAID
  useEffect(() => {
    if (!isOpen || !invoice?.invoiceNumber || paidSuccess || verifying) return;
    const timer = setInterval(async () => {
      try {
        const data = await apiFetch(`/payments/invoice/${invoice.invoiceNumber}`);
        if (data?.invoice?.status === 'PAID') {
          clearInterval(timer);
          handleCheckPaymentStatus(true);
        }
      } catch (_e) {
        // ignore
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [isOpen, invoice?.invoiceNumber, paidSuccess, verifying]);

  const handleSelectPlan = async (planCode) => {
    setSelectedPlanCode(planCode);
    if (invoice && invoice.planCode === planCode && invoice.status === 'PENDING') return;
    const targetUserId = effectiveUserId || invoice?.userId;
    if (!targetUserId) return;

    setLoadingInvoice(true);
    setErrorMsg('');
    try {
      const data = await apiFetch('/payments/create-invoice', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUserId, planCode })
      });
      if (data?.invoice) setInvoice(data.invoice);
      if (data?.merchant) setMerchant(data.merchant);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal membuat tagihan paket.');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Ukuran gambar bukti transfer maksimal 10 MB.');
      return;
    }
    setReceiptFileName(file.name);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptPreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleCheckPaymentStatus = async (isAutoPoll = false) => {
    if (!invoice?.invoiceNumber) return;
    setVerifying(true);
    setVerifyStep(1);
    setErrorMsg('');

    const t1 = setTimeout(() => setVerifyStep(2), 700);
    const t2 = setTimeout(() => setVerifyStep(3), 1500);

    try {
      const minDelay = new Promise((r) => setTimeout(r, isAutoPoll ? 800 : 1800));
      const [data] = await Promise.all([
        apiFetch(`/payments/verify-auto/${invoice.invoiceNumber}`, {
          method: 'POST',
          body: JSON.stringify({
            receiptImageBase64: receiptPreview || null,
            rrnCode: rrnCode.trim() || null
          })
        }),
        minDelay
      ]);

      clearTimeout(t1);
      clearTimeout(t2);
      setVerifyStep(4);
      setPaidSuccess(true);

      if (data?.token) {
        setToken(data.token);
      }

      setTimeout(() => {
        if (onPaymentSuccess) {
          onPaymentSuccess(data);
        }
      }, 1100);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      if (!isAutoPoll) {
        setErrorMsg(
          err.message ||
            'Pembayaran belum terdeteksi masuk. Silakan lampirkan Screenshot Struk Bukti Bayar QRIS Anda agar diverifikasi otomatis.'
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  const copyNominal = () => {
    if (!invoice) return;
    navigator.clipboard?.writeText(String(invoice.totalAmount));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#008CEB]/25 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#118EEA] flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-[#118EEA]/30 shrink-0">
              DANA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Payment Gateway Otomatis — QRIS DANA Bisnis
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Auto-OCR &amp; Webhook Detector</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan QRIS sesuai nominal unik 3 digit, lalu unggah Screenshot Struk Pembayaran untuk aktivasi otomatis
              </p>
            </div>
          </div>

          {onClose && !verifying && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[86vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-extrabold text-amber-300">
                  Verifikasi Pembayaran Membutuhkan Bukti Struk / Mutasi Valid
                </div>
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Plan Selector Cards (Basic / Pro / Ultra) */}
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 mb-2.5">
              1. Pilih Paket Langganan Drafter (Aktif 30 Hari)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {plans.map((p) => {
                const isSelected = selectedPlanCode === p.code;
                return (
                  <div
                    key={p.code}
                    onClick={() => !verifying && !paidSuccess && handleSelectPlan(p.code)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-cyan-950/50 to-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/15'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-white">{p.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.code === 'PRO'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : p.code === 'ULTRA'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {p.badge}
                        </span>
                      </div>

                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-extrabold text-white">
                          Rp {(p.price || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[11px] text-slate-400">/ bulan</span>
                      </div>

                      <ul className="mt-3 space-y-1.5 text-[11px]">
                        {(p.features || []).map((f, i) => {
                          const isNegative = f.toLowerCase().includes('tidak termasuk');
                          return (
                            <li
                              key={i}
                              className={`flex items-start gap-1.5 ${
                                isNegative ? 'text-slate-500 line-through' : 'text-slate-300'
                              }`}
                            >
                              {isNegative ? (
                                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              )}
                              <span>{f}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        Kuota:{' '}
                        <strong className="text-white">
                          {p.monthlyLimit === -1 ? 'Unlimited ∞' : `${p.monthlyLimit}x Convert`}
                        </strong>
                      </span>
                      <span
                        className={`font-extrabold ${
                          isSelected ? 'text-cyan-400' : 'text-slate-500'
                        }`}
                      >
                        {isSelected ? '✓ Terpilih' : 'Pilih Paket'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* QRIS DANA Bisnis Barcode & Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start bg-slate-950/90 border border-slate-800 rounded-3xl p-5">
            {/* Left: DANA Bisnis Barcode Card */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-[270px] bg-white rounded-2xl p-4 text-slate-900 shadow-xl border-2 border-[#118EEA]">
                {/* QRIS & DANA Bisnis Top Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-[#118EEA] text-white font-black text-[11px] tracking-wide">
                      DANA BISNIS
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-700">QRIS</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    GPN • Standar Nasional
                  </span>
                </div>

                <div className="text-center mb-2">
                  <div className="text-xs font-black text-slate-900 uppercase truncate">
                    {merchant.merchantName || 'TOSKA FTTH SND - DANA BISNIS'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    NMID: {merchant.merchantNmid || 'ID1026000088991'}
                  </div>
                </div>

                {/* Barcode Image */}
                <div className="w-52 h-52 mx-auto bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden p-2 relative">
                  {merchant.qrisImageUrl ? (
                    <img
                      src={merchant.qrisImageUrl}
                      alt="Barcode QRIS DANA Bisnis"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                      <QrCode className="w-40 h-40 text-slate-900 stroke-[1.5]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="px-2 py-1 rounded-md bg-[#118EEA] text-white font-black text-[10px] shadow-md border-2 border-white">
                          DANA
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600 font-semibold">
                  <span>DANA / GoPay / OVO / M-Banking</span>
                  <span className="font-mono font-bold text-[#118EEA]">
                    {merchant.danaPhoneNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Invoice Summary, Receipt Upload & Auto-Verification Action */}
            <div className="md:col-span-7 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#38bdf8]">
                    2. Rincian Tagihan Payment Gateway Otomatis
                  </span>
                  <div className="text-sm font-extrabold text-white mt-0.5 font-mono">
                    {loadingInvoice
                      ? 'Membuat Invoice...'
                      : invoice?.invoiceNumber || 'INV-DANA-READY'}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${
                    paidSuccess || invoice?.status === 'PAID'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {paidSuccess || invoice?.status === 'PAID'
                    ? '✓ LUNAS & AKTIF OTOMATIS'
                    : 'MENUNGGU PEMBAYARAN QRIS'}
                </span>
              </div>

              {invoice && (
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Paket Dipilih:</span>
                    <strong className="text-white">{invoice.planName} (30 Hari)</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Harga Dasar Paket:</span>
                    <span className="font-mono">
                      Rp {(invoice.baseAmount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-cyan-300">
                    <span>Kode Unik Verifikasi Mutasi (Wajib Sama):</span>
                    <span className="font-mono font-bold">+{invoice.uniqueCode}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="font-extrabold text-white text-sm">
                      Total Nominal Transfer QRIS:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold text-emerald-400 font-mono">
                        Rp {(invoice.totalAmount || 0).toLocaleString('id-ID')}
                      </span>
                      <button
                        type="button"
                        onClick={copyNominal}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition"
                        title="Salin Nominal Transfer"
                      >
                        {copiedAmount ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Disalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Upload Screenshot Struk Bukti Bayar QRIS for Instant Auto-OCR Verification */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-cyan-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>3. Lampirkan Screenshot Struk Bukti Bayar QRIS (Auto-Scan Nominal) *</span>
                  </span>
                  {receiptPreview && (
                    <span className="text-[10px] font-bold text-emerald-400">✓ Struk Siap Di-scan</span>
                  )}
                </div>

                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleReceiptFileChange}
                  className="hidden"
                />

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className={`flex-1 py-2.5 px-3.5 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-2 transition ${
                      receiptPreview
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">
                      {receiptFileName
                        ? `Struk: ${receiptFileName}`
                        : 'Pilih Screenshot Bukti Bayar (DANA / OVO / GoPay / Bank)'}
                    </span>
                  </button>

                  <input
                    type="text"
                    value={rrnCode}
                    onChange={(e) => setRrnCode(e.target.value)}
                    placeholder="RRN / Kode Ref (Opsional)"
                    className="sm:w-44 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Verification Progress / Action */}
              {verifying ? (
                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs font-extrabold text-cyan-300">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                    <span>
                      {verifyStep === 1 &&
                        'Memindai Struk Bukti Pembayaran QRIS & Mengecek Mutasi...'}
                      {verifyStep === 2 &&
                        `Mencocokkan Nominal Unik Rp ${(invoice?.totalAmount || 0).toLocaleString(
                          'id-ID'
                        )} & Nama Merchant...`}
                      {verifyStep >= 3 &&
                        'Memvalidasi Keaslian Struk & Mengaktifkan Paket Secara Otomatis...'}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#118EEA] via-cyan-400 to-emerald-400 transition-all duration-500"
                      style={{ width: `${verifyStep * 28}%` }}
                    />
                  </div>
                </div>
              ) : paidSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/50 flex items-center gap-3 text-emerald-200 text-xs">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-extrabold text-emerald-300 text-sm">
                      Pembayaran Terverifikasi Otomatis! Akun Anda Kini Aktif
                    </div>
                    <div className="mt-0.5">
                      Akun &amp; kuota <strong>{invoice?.planName}</strong> Anda telah aktif selama 30 hari. Mengalihkan ke Dashboard...
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!invoice || loadingInvoice}
                    onClick={() => handleCheckPaymentStatus(false)}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#118EEA] via-cyan-500 to-emerald-500 hover:from-[#0f7fd1] hover:to-emerald-400 text-white font-extrabold text-xs shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>
                      Saya Sudah Scan &amp; Bayar — Verifikasi Struk &amp; Aktifkan Otomatis
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Sistem memindai nominal unik <strong className="text-cyan-300">Rp {(invoice?.totalAmount || 0).toLocaleString('id-ID')}</strong> pada struk secara otomatis
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
