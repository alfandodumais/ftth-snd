require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');

const { prisma, createProjectFromKmz, getFullProjectById } = require('./projectService');
const { generateHpdbWorkbook } = require('./hpdbGenerator');
const { calculateBoqMetrics, generateBoqWorkbook } = require('./boqGenerator');
const { convertDwgToKmz } = require('./dwgConverter');
const { generateCadFromProject } = require('./kmzToDwgGenerator');
const { parseKmzFile } = require('./kmzParser');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'ftth-snd-super-secret-jwt-key-2026-enterprise';

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Ensure uploads directory exists (use /tmp on serverless environments like Vercel)
const UPLOADS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.kmz' && ext !== '.kml' && ext !== '.dwg') {
      return cb(new Error('Hanya file dengan format .kmz, .kml, atau .dwg yang diperbolehkan.'));
    }
    cb(null, true);
  },
});

// Helper: sanitize user object
function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

async function getOrCreatePaymentSettings() {
  let settings = await prisma.paymentSetting.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.paymentSetting.create({
      data: {
        id: 'default',
        merchantName: 'TOSKA FTTH SND - DANA BISNIS',
        merchantNmid: 'ID1026000088991',
        danaPhoneNumber: '0812-3456-7890',
        autoVerifyMode: true,
        basicPrice: 100000,
        basicLimit: 10,
        proPrice: 250000,
        proLimit: 30,
        ultraPrice: 500000,
        ultraLimit: -1,
      },
    });
  }
  return settings;
}

function getPlanCatalog(settings) {
  return {
    BASIC: {
      code: 'BASIC',
      name: 'Paket BASIC',
      badge: 'Starter SND',
      price: settings.basicPrice || 100000,
      monthlyLimit: settings.basicLimit || 10,
      boqAllowed: false,
      description: 'Maksimal 10x Convert KMZ / bulan (Hanya Excel HPDB & Peta GIS, BoQ tidak termasuk)',
      features: [
        'Kuota 10x Convert KMZ / KML per Bulan',
        'Export & Preview Tabel Excel HPDB.xlsx (58 Kolom)',
        'Visualisasi Peta Topologi GIS Interaktif',
        'Tidak termasuk Export & Tabel BoQ.xlsx',
      ],
    },
    PRO: {
      code: 'PRO',
      name: 'Paket PRO',
      badge: 'Paling Populer',
      price: settings.proPrice || 250000,
      monthlyLimit: settings.proLimit || 30,
      boqAllowed: true,
      description: 'Maksimal 30x Convert KMZ / bulan (Lengkap HPDB.xlsx + BOQ.xlsx + Peta GIS)',
      features: [
        'Kuota 30x Convert KMZ / KML per Bulan',
        'Export & Preview Tabel Excel HPDB.xlsx (58 Kolom)',
        'Termasuk Export & Preview Excel BOQ.xlsx Lengkap',
        'Visualisasi Peta Topologi GIS Interaktif',
      ],
    },
    ULTRA: {
      code: 'ULTRA',
      name: 'Paket ULTRA',
      badge: 'Unlimited Enterprise',
      price: settings.ultraPrice || 500000,
      monthlyLimit: -1,
      boqAllowed: true,
      description: 'UNLIMITED Convert KMZ / bulan tanpa batas + Akses penuh HPDB.xlsx, BOQ.xlsx & Peta GIS',
      features: [
        'UNLIMITED Convert KMZ / KML per Bulan (Tanpa Batas)',
        'Export & Preview Tabel Excel HPDB.xlsx (58 Kolom)',
        'Termasuk Export & Preview Excel BOQ.xlsx Lengkap',
        'Prioritas Pemrosesan & Penyimpanan Cluster',
      ],
    },
  };
}

async function createSubscriptionInvoice(userId, rawPlanCode = 'PRO') {
  const settings = await getOrCreatePaymentSettings();
  const catalog = getPlanCatalog(settings);
  const planCode = ['BASIC', 'PRO', 'ULTRA'].includes(String(rawPlanCode).toUpperCase())
    ? String(rawPlanCode).toUpperCase()
    : 'PRO';
  const plan = catalog[planCode];

  const uniqueCode = Math.floor(101 + Math.random() * 790); // 101..890
  const baseAmount = plan.price;
  const totalAmount = baseAmount + uniqueCode;
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = `INV-DANA-${datePart}-${randPart}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const invoice = await prisma.paymentTransaction.create({
    data: {
      invoiceNumber,
      userId,
      planCode,
      planName: plan.name,
      baseAmount,
      uniqueCode,
      totalAmount,
      paymentMethod: 'QRIS_DANA_BISNIS',
      status: 'PENDING',
      expiresAt,
    },
  });

  return { invoice, settings, plan };
}

async function activateSubscriptionFromInvoice(invoice, ipAddress = null) {
  const settings = await getOrCreatePaymentSettings();
  const catalog = getPlanCatalog(settings);
  const plan = catalog[invoice.planCode] || catalog.PRO;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
  const refCode = invoice.externalReference || `DANA-BIZ-${Date.now().toString().slice(-8)}`;

  const [updatedInvoice, updatedUser] = await prisma.$transaction([
    prisma.paymentTransaction.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: now,
        externalReference: refCode,
      },
    }),
    prisma.user.update({
      where: { id: invoice.userId },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        subscriptionPlan: plan.code,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expiresAt,
        monthlyConvertLimit: plan.monthlyLimit,
        monthlyConvertUsed: 0,
        boqAccessAllowed: plan.boqAllowed,
        billingCycleStart: now,
        lastLoginAt: now,
      },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: invoice.userId,
      action: 'PAYMENT_QRIS_DANA_VERIFIED',
      entityType: 'PAYMENT',
      entityId: invoice.id,
      details: JSON.stringify({
        invoiceNumber: invoice.invoiceNumber,
        planCode: plan.code,
        totalAmount: invoice.totalAmount,
        externalReference: refCode,
      }),
      ipAddress,
    },
  });

  return { updatedInvoice, updatedUser };
}

// Middleware: Authenticate JWT & check APPROVED status
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.query.token;

    if (!token) {
      return res.status(401).json({ message: 'Sesi tidak ditemukan. Silakan login terlebih dahulu.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(401).json({ message: 'Akun pengguna tidak ditemukan.' });
    }

    if (user.status !== 'APPROVED') {
      return res.status(403).json({
        code: `ACCOUNT_${user.status}`,
        message:
          user.status === 'PENDING'
            ? 'Akun Anda belum aktif. Silakan selesaikan pembayaran paket QRIS DANA Bisnis terlebih dahulu.'
            : `Akun Anda tidak aktif (Status: ${user.status}).`,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Sesi telah berakhir atau token tidak valid. Silakan login kembali.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Akses ditolak. Fitur ini hanya untuk Administrator.' });
  }
  next();
}

app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    service: 'FTTH SND Pro Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ============================================================================
// PUBLIC PAYMENT CONFIG & AUTHENTICATION ROUTES
// ============================================================================

app.get('/api/payments/public-config', async (_req, res) => {
  try {
    const settings = await getOrCreatePaymentSettings();
    const plans = getPlanCatalog(settings);
    return res.json({
      merchant: {
        merchantName: settings.merchantName,
        merchantNmid: settings.merchantNmid,
        danaPhoneNumber: settings.danaPhoneNumber,
        qrisImageUrl: settings.qrisImageUrl,
        autoVerifyMode: settings.autoVerifyMode,
      },
      plans: Object.values(plans),
    });
  } catch (err) {
    console.error('Public payment config error:', err);
    return res.status(500).json({ message: 'Gagal memuat konfigurasi paket & pembayaran.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      password,
      employeeId,
      phone,
      department,
      region,
      planCode = 'PRO',
    } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: 'Nama lengkap, username, email, dan password wajib diisi.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password minimal harus terdiri dari 6 karakter.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = String(username).trim().toLowerCase();
    const selectedPlan = ['BASIC', 'PRO', 'ULTRA'].includes(String(planCode).toUpperCase())
      ? String(planCode).toUpperCase()
      : 'PRO';

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanEmail }, { username: cleanUsername }],
      },
    });

    if (existing) {
      return res.status(409).json({
        message:
          existing.email === cleanEmail
            ? 'Email tersebut sudah terdaftar.'
            : 'Username tersebut sudah digunakan.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        fullName: String(fullName).trim(),
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        employeeId: employeeId ? String(employeeId).trim() : null,
        phone: phone ? String(phone).trim() : null,
        department: department ? String(department).trim() : 'SND FTTH',
        region: region ? String(region).trim() : null,
        role: 'DRAFTER',
        status: 'PENDING',
        subscriptionPlan: selectedPlan,
        subscriptionStatus: 'UNPAID',
        monthlyConvertLimit: selectedPlan === 'BASIC' ? 10 : selectedPlan === 'PRO' ? 30 : -1,
        monthlyConvertUsed: 0,
        boqAccessAllowed: selectedPlan !== 'BASIC',
      },
    });

    const { invoice, settings } = await createSubscriptionInvoice(newUser.id, selectedPlan);

    await prisma.auditLog.create({
      data: {
        userId: newUser.id,
        action: 'USER_REGISTER_WITH_INVOICE',
        entityType: 'USER',
        entityId: newUser.id,
        details: JSON.stringify({
          fullName: newUser.fullName,
          email: newUser.email,
          username: newUser.username,
          planCode: selectedPlan,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
        }),
        ipAddress: req.ip,
      },
    });

    return res.status(201).json({
      message:
        'Pendaftaran berhasil! Silakan selesaikan pembayaran QRIS DANA Bisnis agar akun & paket Anda langsung aktif otomatis.',
      user: sanitizeUser(newUser),
      invoice,
      merchant: {
        merchantName: settings.merchantName,
        merchantNmid: settings.merchantNmid,
        danaPhoneNumber: settings.danaPhoneNumber,
        qrisImageUrl: settings.qrisImageUrl,
        autoVerifyMode: settings.autoVerifyMode,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan saat mendaftarkan akun.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/Username dan password wajib diisi.' });
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanId }, { username: cleanId }],
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Kredensial tidak valid. Periksa kembali email/username Anda.' });
    }

    const validPass = await bcrypt.compare(password, user.passwordHash);
    if (!validPass) {
      return res.status(401).json({ message: 'Password yang Anda masukkan salah.' });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({
        code: 'ACCOUNT_REJECTED',
        message: `Pendaftaran akun Anda ditolak oleh Administrator.${
          user.rejectionReason ? ' Alasan: ' + user.rejectionReason : ''
        }`,
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Akun Anda sedang dinonaktifkan sementara oleh Administrator.',
      });
    }

    // If user is PENDING / UNPAID, return pending invoice so they can pay via DANA Bisnis QRIS & auto-activate!
    if (user.role !== 'ADMIN' && (user.status === 'PENDING' || user.subscriptionStatus === 'UNPAID')) {
      let pendingInvoice = await prisma.paymentTransaction.findFirst({
        where: { userId: user.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      const settings = await getOrCreatePaymentSettings();
      if (!pendingInvoice) {
        const created = await createSubscriptionInvoice(
          user.id,
          user.subscriptionPlan !== 'NONE' ? user.subscriptionPlan : 'PRO'
        );
        pendingInvoice = created.invoice;
      }

      return res.status(402).json({
        code: 'PAYMENT_REQUIRED',
        message:
          'Akun Anda belum aktif karena pembayaran paket langganan belum diselesaikan. Silakan scan QRIS DANA Bisnis untuk mengaktifkan akun secara otomatis.',
        user: sanitizeUser(user),
        invoice: pendingInvoice,
        merchant: {
          merchantName: settings.merchantName,
          merchantNmid: settings.merchantNmid,
          danaPhoneNumber: settings.danaPhoneNumber,
          qrisImageUrl: settings.qrisImageUrl,
          autoVerifyMode: settings.autoVerifyMode,
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        details: JSON.stringify({ username: user.username, role: user.role }),
        ipAddress: req.ip,
      },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login berhasil',
      token,
      user: sanitizeUser(updatedUser),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server saat login.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

// ============================================================================
// PAYMENT GATEWAY & QRIS DANA BISNIS ROUTES
// ============================================================================

app.get('/api/payments/invoice/:invoiceNumber', async (req, res) => {
  try {
    const invoice = await prisma.paymentTransaction.findUnique({
      where: { invoiceNumber: req.params.invoiceNumber },
      include: {
        user: {
          select: { id: true, fullName: true, username: true, email: true, role: true },
        },
      },
    });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice pembayaran tidak ditemukan.' });
    }
    const settings = await getOrCreatePaymentSettings();
    return res.json({
      invoice,
      merchant: {
        merchantName: settings.merchantName,
        merchantNmid: settings.merchantNmid,
        danaPhoneNumber: settings.danaPhoneNumber,
        qrisImageUrl: settings.qrisImageUrl,
        autoVerifyMode: settings.autoVerifyMode,
      },
    });
  } catch (err) {
    console.error('Get invoice error:', err);
    return res.status(500).json({ message: 'Gagal memuat detail invoice pembayaran.' });
  }
});

app.post('/api/payments/create-invoice', async (req, res) => {
  try {
    const { userId, planCode } = req.body;
    let targetUserId = userId;

    // Also allow authenticated user from Bearer token
    const authHeader = req.headers.authorization;
    if (!targetUserId && authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        targetUserId = decoded.userId;
      } catch (_e) {
        // ignore
      }
    }

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID wajib disertakan untuk membuat invoice.' });
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    const { invoice, settings } = await createSubscriptionInvoice(user.id, planCode || 'PRO');

    return res.status(201).json({
      message: 'Invoice pembayaran QRIS DANA Bisnis berhasil dibuat.',
      invoice,
      merchant: {
        merchantName: settings.merchantName,
        merchantNmid: settings.merchantNmid,
        danaPhoneNumber: settings.danaPhoneNumber,
        qrisImageUrl: settings.qrisImageUrl,
        autoVerifyMode: settings.autoVerifyMode,
      },
    });
  } catch (err) {
    console.error('Create invoice error:', err);
    return res.status(500).json({ message: 'Gagal membuat invoice pembayaran.' });
  }
});

// Check Payment Status (For Drafter) or Manual Force-Verify (For Admin Only)
app.post('/api/payments/verify-auto/:invoiceNumber', async (req, res) => {
  try {
    const invoice = await prisma.paymentTransaction.findUnique({
      where: { invoiceNumber: req.params.invoiceNumber },
    });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice pembayaran tidak ditemukan.' });
    }

    // Check if caller is an authenticated ADMIN
    let isCallerAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        if (decoded?.role === 'ADMIN') {
          isCallerAdmin = true;
        }
      } catch (_e) {
        // ignore invalid token
      }
    }

    // If invoice is already marked PAID (by DANA Bisnis Webhook or by Admin), issue token & login!
    if (invoice.status === 'PAID') {
      const existingUser = await prisma.user.findUnique({ where: { id: invoice.userId } });
      const token = jwt.sign(
        { userId: existingUser.id, role: existingUser.role, username: existingUser.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        message: `Pembayaran QRIS DANA Bisnis sebesar Rp ${invoice.totalAmount.toLocaleString(
          'id-ID'
        )} telah terverifikasi! Paket ${invoice.planCode} Anda kini AKTIF.`,
        invoice,
        token,
        user: sanitizeUser(existingUser),
      });
    }

    // If caller is ADMIN clicking "Verifikasi & Aktifkan" in Admin Dashboard, approve & activate now
    if (isCallerAdmin) {
      const { updatedInvoice, updatedUser } = await activateSubscriptionFromInvoice(invoice, req.ip);
      const token = jwt.sign(
        { userId: updatedUser.id, role: updatedUser.role, username: updatedUser.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        message: `Tagihan ${updatedInvoice.invoiceNumber} (Rp ${updatedInvoice.totalAmount.toLocaleString(
          'id-ID'
        )}) berhasil diverifikasi oleh Admin & akun diaktifkan!`,
        invoice: updatedInvoice,
        token,
        user: sanitizeUser(updatedUser),
      });
    }

    // If Drafter attached a Screenshot of their QRIS Payment Receipt, run OCR to verify nominal & merchant!
    const { receiptImageBase64, rrnCode } = req.body || {};
    if (receiptImageBase64 && String(receiptImageBase64).includes('base64,')) {
      const base64Part = String(receiptImageBase64).split('base64,')[1];
      const imgBuffer = Buffer.from(base64Part, 'base64');

      const ocrResult = await Tesseract.recognize(imgBuffer, 'eng');
      const rawText = String(ocrResult?.data?.text || '');
      const lowerText = rawText.toLowerCase();

      // 1. Check if the exact totalAmount (e.g. 1710 / 1.710 / 1,710) is present in the receipt text
      const targetAmount = Number(invoice.totalAmount);
      const formattedDot = targetAmount.toLocaleString('id-ID'); // e.g. "1.710" or "50.563"
      const formattedComma = targetAmount.toLocaleString('en-US'); // e.g. "1,710" or "50,563"
      const rawDigits = String(targetAmount); // e.g. "1710" or "50563"

      const hasExactAmount =
        rawText.includes(formattedDot) ||
        rawText.includes(formattedComma) ||
        rawText.includes(rawDigits);

      // 2. Check if the image is a real payment receipt (merchant name or payment indicators)
      const merchantKeywords = ['ftth', 'geostudio', 'toska', 'konte', 'dana', 'qris'];
      const receiptKeywords = [
        'berhasil',
        'sukses',
        'success',
        'menerima',
        'transaksi',
        'rrn',
        'ovo',
        'gopay',
        'pembayaran',
        'total',
        'nominal',
        'acquirer',
      ];

      const hasMerchantMatch = merchantKeywords.some((k) => lowerText.includes(k));
      const hasReceiptMatch = receiptKeywords.some((k) => lowerText.includes(k));

      if (!hasExactAmount || !hasMerchantMatch || !hasReceiptMatch) {
        return res.status(402).json({
          code: 'INVALID_RECEIPT_OCR',
          message: !hasExactAmount
            ? `Struk bukti bayar tidak menampilkan nominal unik Rp ${formattedDot} (+${invoice.uniqueCode}). Pastikan Anda mengunggah screenshot bukti transfer QRIS dengan nominal tepat Rp ${formattedDot}.`
            : 'Gambar yang diunggah tidak terdeteksi sebagai struk bukti pembayaran QRIS ke FTTH-SND GeoStudio / DANA Bisnis yang valid.',
        });
      }

      // Extract RRN or Transaction ID from OCR if present for anti-replay
      const rrnMatch = rawText.match(/RRN[\s:]*([A-Za-z0-9-]{6,25})/i);
      const detectedRrn = rrnCode || (rrnMatch ? rrnMatch[1] : null);
      if (detectedRrn) {
        const duplicateTx = await prisma.paymentTransaction.findFirst({
          where: {
            externalReference: `OCR-RRN-${detectedRrn}`,
            status: 'PAID',
            NOT: { id: invoice.id },
          },
        });
        if (duplicateTx) {
          return res.status(402).json({
            code: 'DUPLICATE_RECEIPT',
            message: `Struk dengan kode RRN/Referensi (${detectedRrn}) sudah pernah digunakan pada transaksi sebelumnya.`,
          });
        }
        invoice.externalReference = `OCR-RRN-${detectedRrn}`;
      } else {
        invoice.externalReference = `OCR-VERIFIED-${Date.now()}`;
      }

      const { updatedInvoice, updatedUser } = await activateSubscriptionFromInvoice(invoice, req.ip);
      const token = jwt.sign(
        { userId: updatedUser.id, role: updatedUser.role, username: updatedUser.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: `Struk Bukti Bayar QRIS (Rp ${updatedInvoice.totalAmount.toLocaleString(
          'id-ID'
        )}) berhasil dipindai & diverifikasi otomatis! Paket ${updatedInvoice.planCode} Anda kini AKTIF.`,
        invoice: updatedInvoice,
        token,
        user: sanitizeUser(updatedUser),
      });
    }

    // Otherwise (Drafter clicked button without uploading receipt and webhook hasn't arrived): REJECT!
    return res.status(402).json({
      code: 'PAYMENT_NOT_DETECTED',
      message: `Pembayaran sebesar Rp ${invoice.totalAmount.toLocaleString(
        'id-ID'
      )} (termasuk kode unik +${invoice.uniqueCode}) belum terdeteksi otomatis. Silakan lampirkan Screenshot Struk Bukti Bayar QRIS Anda pada kolom Langkah 3 di bawah agar sistem memindai nominal Rp ${invoice.totalAmount.toLocaleString(
        'id-ID'
      )} & mengaktifkan akun Anda secara otomatis detik ini juga!`,
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ message: 'Gagal memeriksa status pembayaran.' });
  }
});

// External Webhook Endpoint for DANA Bisnis Notification Forwarder / Payment Gateway Callback
app.post('/api/payments/webhook/dana', async (req, res) => {
  try {
    const {
      invoiceNumber,
      amount,
      totalAmount,
      externalReference,
      text,
      message,
      body,
      title,
    } = req.body || {};

    let paidAmount = Number(
      String(totalAmount || amount || '')
        .replace(/[^0-9]/g, '')
    );

    // If sent from Android Notification Forwarder / MacroDroid (e.g., "Kamu menerima Rp 50.563" or "Rp50.563")
    if (!paidAmount) {
      const combinedText = `${title || ''} ${text || ''} ${message || ''} ${body || ''}`;
      const rpMatches = combinedText.match(/Rp[\s.]*([0-9][0-9.,]*)/gi) || [];
      for (const m of rpMatches) {
        const cleanDigits = Number(m.replace(/Rp/i, '').replace(/[^0-9]/g, ''));
        if (cleanDigits >= 1000) {
          paidAmount = cleanDigits;
          break;
        }
      }
      if (!paidAmount) {
        const genericNumbers = combinedText.match(/\b\d{2,3}[.]?\d{3}\b/g) || [];
        for (const n of genericNumbers) {
          const cleanDigits = Number(n.replace(/[^0-9]/g, ''));
          if (cleanDigits >= 1000) {
            paidAmount = cleanDigits;
            break;
          }
        }
      }
    }

    let invoice = null;
    if (invoiceNumber) {
      invoice = await prisma.paymentTransaction.findUnique({
        where: { invoiceNumber: String(invoiceNumber) },
      });
    } else if (paidAmount > 0) {
      // Match by unique 3-digit totalAmount on PENDING invoice
      invoice = await prisma.paymentTransaction.findFirst({
        where: { totalAmount: paidAmount, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!invoice) {
      return res.status(404).json({
        message: `Tidak ditemukan tagihan PENDING dengan nominal unik Rp ${(paidAmount || 0).toLocaleString('id-ID')}.`,
        detectedAmount: paidAmount || 0,
      });
    }

    if (externalReference) {
      invoice.externalReference = String(externalReference);
    }

    const { updatedInvoice, updatedUser } = await activateSubscriptionFromInvoice(invoice, req.ip);
    return res.json({
      status: 'OK',
      message: 'Mutasi QRIS DANA Bisnis cocok! Akun & Paket langsung diaktifkan otomatis.',
      invoiceNumber: updatedInvoice.invoiceNumber,
      totalAmount: updatedInvoice.totalAmount,
      userId: updatedUser.id,
      plan: updatedUser.subscriptionPlan,
    });
  } catch (err) {
    console.error('DANA Webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing error.' });
  }
});

// ============================================================================
// ADMIN USER MANAGEMENT & AUDIT LOG ROUTES
// ============================================================================

app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      pendingUsers,
      approvedUsers,
      rejectedUsers,
      totalProjects,
      totalExports,
      projectsAgg,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { status: 'APPROVED' } }),
      prisma.user.count({ where: { status: 'REJECTED' } }),
      prisma.project.count(),
      prisma.exportHistory.count(),
      prisma.project.aggregate({
        _sum: {
          totalHomepass: true,
          totalFat: true,
          totalPoles: true,
          totalCableLengthM: true,
        },
      }),
    ]);

    return res.json({
      totalUsers,
      pendingUsers,
      approvedUsers,
      rejectedUsers,
      totalProjects,
      totalExports,
      totalHomepass: projectsAgg._sum.totalHomepass || 0,
      totalFat: projectsAgg._sum.totalFat || 0,
      totalPoles: projectsAgg._sum.totalPoles || 0,
      totalCableLengthM: projectsAgg._sum.totalCableLengthM || 0,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ message: 'Gagal memuat statistik admin.' });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        approvedBy: {
          select: { id: true, fullName: true, username: true },
        },
        projects: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            clusterCode: true,
            clusterName: true,
            kmzFileName: true,
            region: true,
            province: true,
            regencyCity: true,
            district: true,
            subdistrict: true,
            totalFdt: true,
            totalFat: true,
            totalHomepass: true,
            totalPoles: true,
            totalCableRouteM: true,
            totalCableLengthM: true,
            totalSlingWireM: true,
            createdAt: true,
          },
        },
        _count: {
          select: { projects: true, exportHistories: true },
        },
      },
    });

    return res.json({
      users: users.map((u) => sanitizeUser(u)),
    });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ message: 'Gagal memuat daftar pengguna.' });
  }
});

app.patch('/api/admin/users/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: 'APPROVED',
        role: role && ['ADMIN', 'SUPERVISOR', 'DRAFTER'].includes(role) ? role : undefined,
        approvedById: req.user.id,
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'USER_APPROVED',
        entityType: 'USER',
        entityId: updated.id,
        details: JSON.stringify({
          approvedUsername: updated.username,
          approvedEmail: updated.email,
          role: updated.role,
        }),
        ipAddress: req.ip,
      },
    });

    return res.json({
      message: `Akun ${updated.fullName} (@${updated.username}) berhasil disetujui (APPROVED).`,
      user: sanitizeUser(updated),
    });
  } catch (err) {
    console.error('Approve user error:', err);
    return res.status(500).json({ message: 'Gagal menyetujui akun pengguna.' });
  }
});

app.patch('/api/admin/users/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (id === req.user.id) {
      return res.status(400).json({ message: 'Anda tidak dapat menolak akun Anda sendiri.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Tidak memenuhi kriteria verifikasi tim SND.',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'USER_REJECTED',
        entityType: 'USER',
        entityId: updated.id,
        details: JSON.stringify({
          rejectedUsername: updated.username,
          reason: updated.rejectionReason,
        }),
        ipAddress: req.ip,
      },
    });

    return res.json({
      message: `Akun ${updated.fullName} telah ditolak.`,
      user: sanitizeUser(updated),
    });
  } catch (err) {
    console.error('Reject user error:', err);
    return res.status(500).json({ message: 'Gagal menolak akun pengguna.' });
  }
});

app.patch('/api/admin/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role } = req.body;

    if (id === req.user.id && status && status !== 'APPROVED') {
      return res.status(400).json({ message: 'Tidak dapat menonaktifkan akun Administrator sendiri.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: status || undefined,
        role: role || undefined,
        approvedById: status === 'APPROVED' ? req.user.id : undefined,
        approvedAt: status === 'APPROVED' ? new Date() : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'USER_STATUS_UPDATED',
        entityType: 'USER',
        entityId: updated.id,
        details: JSON.stringify({ username: updated.username, status: updated.status, role: updated.role }),
        ipAddress: req.ip,
      },
    });

    return res.json({
      message: `Status pengguna ${updated.fullName} berhasil diperbarui.`,
      user: sanitizeUser(updated),
    });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui status pengguna.' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Tidak dapat menghapus akun Anda sendiri.' });
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    await prisma.user.updateMany({
      where: { approvedById: id },
      data: { approvedById: null },
    });

    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'USER_DELETED',
        entityType: 'USER',
        entityId: id,
        details: JSON.stringify({ username: target.username, email: target.email }),
        ipAddress: req.ip,
      },
    });

    return res.json({ message: `Pengguna ${target.fullName} berhasil dihapus.` });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ message: 'Gagal menghapus pengguna.' });
  }
});

app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, fullName: true, username: true, role: true },
        },
      },
    });
    return res.json({ logs });
  } catch (err) {
    console.error('Audit logs error:', err);
    return res.status(500).json({ message: 'Gagal memuat riwayat audit.' });
  }
});

// Admin Payment Gateway & DANA Bisnis QRIS Settings
app.get('/api/admin/payment-settings', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const settings = await getOrCreatePaymentSettings();
    const transactions = await prisma.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            department: true,
            region: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
          },
        },
      },
    });
    return res.json({ settings, transactions });
  } catch (err) {
    console.error('Get admin payment settings error:', err);
    return res.status(500).json({ message: 'Gagal memuat pengaturan payment gateway.' });
  }
});

app.put('/api/admin/payment-settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    await getOrCreatePaymentSettings();
    const {
      merchantName,
      merchantNmid,
      danaPhoneNumber,
      qrisImageUrl,
      autoVerifyMode,
      basicPrice,
      basicLimit,
      proPrice,
      proLimit,
      ultraPrice,
    } = req.body;

    const updated = await prisma.paymentSetting.update({
      where: { id: 'default' },
      data: {
        merchantName: merchantName !== undefined ? String(merchantName).trim() : undefined,
        merchantNmid: merchantNmid !== undefined ? String(merchantNmid).trim() : undefined,
        danaPhoneNumber: danaPhoneNumber !== undefined ? String(danaPhoneNumber).trim() : undefined,
        qrisImageUrl: qrisImageUrl !== undefined ? qrisImageUrl : undefined,
        autoVerifyMode: autoVerifyMode !== undefined ? Boolean(autoVerifyMode) : undefined,
        basicPrice: basicPrice !== undefined ? Number(basicPrice) : undefined,
        basicLimit: basicLimit !== undefined ? Number(basicLimit) : undefined,
        proPrice: proPrice !== undefined ? Number(proPrice) : undefined,
        proLimit: proLimit !== undefined ? Number(proLimit) : undefined,
        ultraPrice: ultraPrice !== undefined ? Number(ultraPrice) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PAYMENT_SETTINGS_UPDATED',
        entityType: 'PAYMENT_SETTING',
        entityId: 'default',
        details: JSON.stringify({
          merchantName: updated.merchantName,
          basicPrice: updated.basicPrice,
          proPrice: updated.proPrice,
          ultraPrice: updated.ultraPrice,
          hasCustomQris: Boolean(updated.qrisImageUrl),
        }),
        ipAddress: req.ip,
      },
    });

    return res.json({
      message: 'Pengaturan Barcode QRIS DANA Bisnis & Harga Paket berhasil disimpan!',
      settings: updated,
    });
  } catch (err) {
    console.error('Update admin payment settings error:', err);
    return res.status(500).json({ message: 'Gagal menyimpan pengaturan payment gateway.' });
  }
});

// Allow Admin to manually update a user's subscription plan or reset convert quota
app.put('/api/admin/users/:id/subscription', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { planCode, resetQuota } = req.body;
    const settings = await getOrCreatePaymentSettings();
    const catalog = getPlanCatalog(settings);
    const plan = catalog[String(planCode || 'PRO').toUpperCase()] || catalog.PRO;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: 'APPROVED',
        subscriptionPlan: plan.code,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expiresAt,
        monthlyConvertLimit: plan.monthlyLimit,
        monthlyConvertUsed: resetQuota ? 0 : undefined,
        boqAccessAllowed: plan.boqAllowed,
      },
    });

    return res.json({
      message: `Paket langganan ${updated.fullName} berhasil diperbarui ke ${plan.name}.`,
      user: sanitizeUser(updated),
    });
  } catch (err) {
    console.error('Update user subscription error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui paket langganan pengguna.' });
  }
});

// ============================================================================
// PROJECT & KMZ CONVERTER ROUTES
// ============================================================================

function canAccessProject(user, project) {
  if (!user || !project) return false;
  if (user.role === 'ADMIN') return true;
  return project.createdById === user.id;
}

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const whereClause = {};
    if (req.user.role === 'ADMIN') {
      if (req.query.userId && req.query.userId !== 'ALL') {
        whereClause.createdById = String(req.query.userId);
      }
    } else {
      whereClause.createdById = req.user.id;
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            department: true,
            region: true,
            role: true,
          },
        },
        fdts: {
          orderBy: { fdtIndex: 'asc' },
          select: {
            id: true,
            fdtIndex: true,
            sheetName: true,
            fdtId: true,
            fdtCapacity: true,
            totalHp: true,
            totalFat: true,
          },
        },
        _count: {
          select: { exportHistories: true },
        },
      },
    });
    return res.json({ projects });
  } catch (err) {
    console.error('List projects error:', err);
    return res.status(500).json({ message: 'Gagal memuat daftar proyek SND.' });
  }
});

app.post('/api/projects/upload', requireAuth, upload.single('kmzFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Silakan pilih file .kmz, .kml, atau .dwg untuk diunggah.' });
    }

    // Enforce Monthly Subscription & Convert Quota for Drafters
    if (req.user.role !== 'ADMIN') {
      if (
        req.user.subscriptionStatus !== 'ACTIVE' ||
        req.user.subscriptionPlan === 'NONE' ||
        (req.user.subscriptionExpiresAt && new Date(req.user.subscriptionExpiresAt) < new Date())
      ) {
        return res.status(403).json({
          code: 'SUBSCRIPTION_INACTIVE',
          message:
            'Masa aktif paket langganan Anda telah berakhir atau belum aktif. Silakan lakukan pembayaran/perpanjangan paket via QRIS DANA Bisnis.',
        });
      }

      const limit = req.user.monthlyConvertLimit;
      const used = req.user.monthlyConvertUsed || 0;
      if (limit !== -1 && used >= limit) {
        return res.status(403).json({
          code: 'QUOTA_EXCEEDED',
          message: `Kuota Convert bulanan Anda untuk Paket ${req.user.subscriptionPlan} telah habis (${used}/${limit} Convert). Silakan Upgrade ke Paket PRO (30x) atau ULTRA (Unlimited) melalui QRIS DANA Bisnis!`,
        });
      }
    }

    const overrides = {};
    const overrideFields = [
      'clusterCode',
      'clusterName',
      'oltName',
      'feederCode',
      'region',
      'province',
      'regencyCity',
      'district',
      'subdistrict',
      'postalCode',
      'fatAddress',
      'addressPrefix',
      'street',
      'netType',
      'dwellingType',
      'homepassSource',
      'installationType',
      'networkPresence',
      'rollOutId',
      'projectIdCode',
      'complexName',
      'anchorLat',
      'anchorLon',
    ];
    for (const f of overrideFields) {
      if (req.body[f] !== undefined && req.body[f] !== '') {
        overrides[f] = req.body[f];
      }
    }

    let targetFilePath = req.file.path;
    let targetOriginalName = req.file.originalname;
    let targetFileSize = req.file.size;

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.dwg') {
      const dwgBuf = fs.readFileSync(req.file.path);
      const convRes = await convertDwgToKmz(dwgBuf, overrides);
      const convertedKmzName = `${path.basename(req.file.originalname, ext)}.kmz`;
      const convertedKmzPath = path.join(UPLOADS_DIR, `${Date.now()}-${convertedKmzName}`);
      fs.writeFileSync(convertedKmzPath, convRes.kmzBuffer);
      targetFilePath = convertedKmzPath;
      targetOriginalName = convertedKmzName;
      targetFileSize = convRes.kmzBuffer.length;
    }

    const project = await createProjectFromKmz({
      filePath: targetFilePath,
      originalName: targetOriginalName,
      fileSize: targetFileSize,
      userId: req.user.id,
      overrides,
    });

    // Increment monthlyConvertUsed counter for user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        monthlyConvertUsed: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: ext === '.dwg' ? 'PROJECT_UPLOAD_DWG' : 'PROJECT_UPLOAD_KMZ',
        entityType: 'PROJECT',
        entityId: project.id,
        details: JSON.stringify({
          fileName: req.file.originalname,
          clusterCode: project.clusterCode,
          clusterName: project.clusterName,
          totalHomepass: project.totalHomepass,
          totalFat: project.totalFat,
          monthlyConvertUsed: updatedUser.monthlyConvertUsed,
          monthlyConvertLimit: updatedUser.monthlyConvertLimit,
        }),
        ipAddress: req.ip,
      },
    });

    const boqMetrics = calculateBoqMetrics(project);

    return res.status(201).json({
      message: ext === '.dwg'
        ? `AutoCAD DWG "${req.file.originalname}" berhasil dikonversi ke KMZ dan disinkronkan (${project.totalHomepass} Homepass, ${project.totalFat} FAT, ${project.totalFdt} FDT).`
        : `File KMZ "${req.file.originalname}" berhasil diekstrak dan disinkronkan (${project.totalHomepass} Homepass, ${project.totalFat} FAT, ${project.totalFdt} FDT).`,
      project,
      boqMetrics,
      monthlyConvertUsed: updatedUser.monthlyConvertUsed,
      monthlyConvertLimit: updatedUser.monthlyConvertLimit,
    });
  } catch (error) {
    console.error('Error uploading/converting project file:', error);
    return res.status(500).json({
      message: 'Gagal memproses file desain. Pastikan file valid sesuai format standar SND.',
      error: error.message,
    });
  }
});

// Dedicated DWG to KMZ Converter Route (accessible from Landing Page demo and App Studio)
app.post('/api/convert/dwg-to-kmz', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Silakan pilih file .dwg untuk dikonversi.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.dwg') {
      return res.status(400).json({ message: 'Hanya file dengan format .dwg yang diperbolehkan untuk konversi.' });
    }

    const options = {
      anchorLat: req.body.anchorLat,
      anchorLon: req.body.anchorLon,
      clusterCode: req.body.clusterCode,
      clusterName: req.body.clusterName,
      address: req.body.address,
    };

    const dwgBuf = fs.readFileSync(req.file.path);
    const convRes = await convertDwgToKmz(dwgBuf, options);

    const safeBaseName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const outFilename = `${safeBaseName}_CONVERTED.kmz`;
    const outPath = path.join(UPLOADS_DIR, `${Date.now()}-${outFilename}`);
    fs.writeFileSync(outPath, convRes.kmzBuffer);

    if (req.query.download === 'true' || req.headers.accept?.includes('application/vnd.google-earth.kmz')) {
      res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
      res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
      return res.send(convRes.kmzBuffer);
    }

    const { parseKmzFile } = require('./kmzParser');
    let projectPreview = null;
    try {
      projectPreview = await parseKmzFile(convRes.kmzBuffer);
    } catch (parseErr) {
      console.warn('Preview parse warning:', parseErr.message);
    }

    const downloadFilename = path.basename(outPath);
    return res.json({
      success: true,
      message: 'Konversi AutoCAD DWG ke Google Earth KMZ berhasil!',
      metadata: convRes.metadata,
      stats: convRes.stats,
      downloadUrl: `/api/convert/dwg-to-kmz/download/${downloadFilename}`,
      downloadFilename: outFilename,
      projectPreview: projectPreview ? {
        clusterCode: projectPreview.clusterCode,
        clusterName: projectPreview.clusterName,
        totalFat: projectPreview.totalFat,
        totalHomepass: projectPreview.totalHomepass,
        totalPoles: projectPreview.totalPoles,
        totalCableRouteM: projectPreview.totalCableRouteM,
        totalCableLengthM: projectPreview.totalCableLengthM,
        totalSlingWireM: projectPreview.totalSlingWireM,
      } : null,
    });
  } catch (error) {
    console.error('Error converting DWG to KMZ:', error);
    return res.status(500).json({
      message: 'Gagal mengonversi file DWG ke KMZ.',
      error: error.message,
    });
  }
});

// Download converted KMZ file
app.get('/api/convert/dwg-to-kmz/download/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File KMZ tidak ditemukan atau telah kedaluwarsa.' });
    }
    const downloadName = filename.replace(/^\d+-/, '');
    res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ message: 'Gagal mengunduh file KMZ.' });
  }
});

// Dedicated KMZ to AutoCAD DWG & DXF Converter Route (Direct & Interactive)
app.post('/api/convert/kmz-to-dwg', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Silakan pilih file .kmz atau .kml untuk dikonversi.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.kmz' && ext !== '.kml') {
      return res.status(400).json({ message: 'Hanya file dengan format .kmz atau .kml yang diperbolehkan untuk konversi ke AutoCAD.' });
    }

    const kmzBuffer = fs.readFileSync(req.file.path);
    const parsedProject = await parseKmzFile(kmzBuffer);

    const cadRes = await generateCadFromProject(parsedProject);

    const safeBaseName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();

    // Save DXF
    const dxfFilename = `${safeBaseName}.dxf`;
    const savedDxfFilename = `${timestamp}-${dxfFilename}`;
    const savedDxfPath = path.join(UPLOADS_DIR, savedDxfFilename);
    fs.writeFileSync(savedDxfPath, cadRes.dxfBuffer);

    // Save DWG if generated
    let dwgFilename = null;
    let savedDwgFilename = null;
    if (cadRes.dwgBuffer) {
      dwgFilename = `${safeBaseName}.dwg`;
      savedDwgFilename = `${timestamp}-${dwgFilename}`;
      const savedDwgPath = path.join(UPLOADS_DIR, savedDwgFilename);
      fs.writeFileSync(savedDwgPath, cadRes.dwgBuffer);
    }

    return res.json({
      success: true,
      message: 'Konversi Google Earth KMZ ke AutoCAD DWG & DXF berhasil!',
      hasNativeDwg: Boolean(cadRes.dwgBuffer),
      dwgFilename,
      dxfFilename,
      downloadDwgUrl: savedDwgFilename ? `/api/convert/download-cad/${savedDwgFilename}` : null,
      downloadDxfUrl: `/api/convert/download-cad/${savedDxfFilename}`,
      stats: cadRes.stats,
      preview: {
        clusterCode: parsedProject.clusterCode,
        clusterName: parsedProject.clusterName,
        totalFdt: parsedProject.totalFdt,
        totalFat: parsedProject.totalFat,
        totalHomepass: parsedProject.totalHomepass,
        totalPoles: cadRes.stats.totalPoles,
        totalCableRouteM: parsedProject.totalCableRouteM,
        totalCableLengthM: parsedProject.totalCableLengthM,
        totalSlingWireM: parsedProject.totalSlingWireM,
        utmProjection: cadRes.stats.utmProjection,
      },
    });
  } catch (error) {
    console.error('Error converting KMZ to DWG:', error);
    return res.status(500).json({
      message: 'Gagal mengonversi file KMZ ke AutoCAD.',
      error: error.message,
    });
  }
});

// Download converted CAD file (DWG or DXF)
app.get('/api/convert/download-cad/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File CAD tidak ditemukan atau telah kedaluwarsa.' });
    }
    const ext = path.extname(filename).toLowerCase();
    const downloadName = filename.replace(/^\d+-/, '');

    if (ext === '.dwg') {
      res.setHeader('Content-Type', 'application/acad');
    } else if (ext === '.dxf') {
      res.setHeader('Content-Type', 'application/dxf');
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Download CAD error:', error);
    return res.status(500).json({ message: 'Gagal mengunduh file CAD.' });
  }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const project = await getFullProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat mengakses cluster KMZ yang Anda konversi sendiri.',
      });
    }
    const boqMetrics = calculateBoqMetrics(project);
    return res.json({ project, boqMetrics });
  } catch (err) {
    console.error('Get project detail error:', err);
    return res.status(500).json({ message: 'Gagal memuat detail proyek.' });
  }
});

app.get('/api/projects/:id/boq-preview', requireAuth, async (req, res) => {
  try {
    if (
      req.user.role !== 'ADMIN' &&
      (req.user.subscriptionPlan === 'BASIC' || !req.user.boqAccessAllowed)
    ) {
      return res.status(403).json({
        code: 'BOQ_NOT_INCLUDED',
        message:
          'Fitur Tabel & Export BoQ.xlsx tidak termasuk dalam Paket BASIC. Silakan Upgrade ke Paket PRO atau ULTRA melalui QRIS DANA Bisnis.',
      });
    }

    const project = await getFullProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat mengakses cluster KMZ yang Anda konversi sendiri.',
      });
    }

    const wb = await generateBoqWorkbook(project);

    const extractSheetRows = (ws, maxCols) => {
      const rows = [];
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const cells = [];
        let hasContent = false;
        for (let c = 1; c <= maxCols; c++) {
          const cell = row.getCell(c);
          let raw = cell.value;
          let formula = null;
          let displayVal = raw;

          if (raw && typeof raw === 'object') {
            if ('richText' in raw && Array.isArray(raw.richText)) {
              displayVal = raw.richText.map((rt) => rt.text).join('');
            } else if ('formula' in raw || 'sharedFormula' in raw) {
              formula = raw.formula || raw.sharedFormula;
              displayVal = raw.result !== undefined ? raw.result : '';
              if (displayVal && typeof displayVal === 'object' && 'error' in displayVal) {
                displayVal = displayVal.error;
              }
            }
          }

          if (displayVal !== null && displayVal !== undefined && displayVal !== '') {
            hasContent = true;
          }

          cells.push({
            col: c,
            address: cell.address,
            value: displayVal ?? '',
            formula,
            bold: Boolean(cell.font?.bold),
            fillArgb: cell.fill?.fgColor?.argb || null,
          });
        }
        if (hasContent || r <= 15) {
          rows.push({ rowNumber: r, cells });
        }
      }
      return rows;
    };

    const nroSheet = wb.getWorksheet('BoQ NRO Cluster');
    const bomSheet = wb.getWorksheet('BoM AE');

    return res.json({
      nroClusterRows: extractSheetRows(nroSheet, 17),
      bomAeRows: extractSheetRows(bomSheet, 10),
    });
  } catch (err) {
    console.error('BoQ preview error:', err);
    return res.status(500).json({ message: 'Gagal membuat preview lembar kerja BoQ.' });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, existing)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat mengubah cluster KMZ yang Anda konversi sendiri.',
      });
    }

    const {
      clusterCode,
      clusterName,
      description,
      oltName,
      feederCode,
      region,
      province,
      regencyCity,
      district,
      subdistrict,
      postalCode,
      fatAddress,
      addressPrefix,
      street,
      netType,
      dwellingType,
      homepassSource,
      installationType,
      networkPresence,
      rollOutId,
      projectIdCode,
      complexName,
      fdts,
    } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          clusterCode: clusterCode ?? existing.clusterCode,
          clusterName: clusterName ?? existing.clusterName,
          description: description ?? existing.description,
          oltName: oltName ?? existing.oltName,
          feederCode: feederCode ?? existing.feederCode,
          region: region ?? existing.region,
          province: province ?? existing.province,
          regencyCity: regencyCity ?? existing.regencyCity,
          district: district ?? existing.district,
          subdistrict: subdistrict ?? existing.subdistrict,
          postalCode: postalCode !== undefined ? String(postalCode) : existing.postalCode,
          fatAddress: fatAddress ?? existing.fatAddress,
          addressPrefix: addressPrefix ?? existing.addressPrefix,
          street: street ?? existing.street,
          netType: netType ?? existing.netType,
          dwellingType: dwellingType ?? existing.dwellingType,
          homepassSource: homepassSource ?? existing.homepassSource,
          installationType: installationType ?? existing.installationType,
          networkPresence:
            networkPresence !== undefined ? Number(networkPresence) : existing.networkPresence,
          rollOutId: rollOutId !== undefined ? rollOutId : existing.rollOutId,
          projectIdCode: projectIdCode !== undefined ? projectIdCode : existing.projectIdCode,
          complexName: complexName !== undefined ? complexName : existing.complexName,
        },
      });

      if (Array.isArray(fdts)) {
        for (const f of fdts) {
          if (!f.id) continue;
          await tx.projectFdt.update({
            where: { id: f.id },
            data: {
              fdtId: f.fdtId,
              fdtCapacity: f.fdtCapacity,
              oltCode: f.oltCode,
              oltName: f.oltName,
              coordString: f.coordString,
              routeLineA24: f.routeLineA24 !== undefined ? Number(f.routeLineA24) : undefined,
              routeLineB24: f.routeLineB24 !== undefined ? Number(f.routeLineB24) : undefined,
              routeLineC24: f.routeLineC24 !== undefined ? Number(f.routeLineC24) : undefined,
              routeLineD24: f.routeLineD24 !== undefined ? Number(f.routeLineD24) : undefined,
              routeLineA36: f.routeLineA36 !== undefined ? Number(f.routeLineA36) : undefined,
              routeLineB36: f.routeLineB36 !== undefined ? Number(f.routeLineB36) : undefined,
              routeLineC36: f.routeLineC36 !== undefined ? Number(f.routeLineC36) : undefined,
              routeLineD36: f.routeLineD36 !== undefined ? Number(f.routeLineD36) : undefined,
              routeLineA48: f.routeLineA48 !== undefined ? Number(f.routeLineA48) : undefined,
              routeLineB48: f.routeLineB48 !== undefined ? Number(f.routeLineB48) : undefined,
              routeLineC48: f.routeLineC48 !== undefined ? Number(f.routeLineC48) : undefined,
              routeLineD48: f.routeLineD48 !== undefined ? Number(f.routeLineD48) : undefined,
              slingWireFormula: f.slingWireFormula,
              slingWireRouteM:
                f.slingWireRouteM !== undefined ? Number(f.slingWireRouteM) : undefined,
              newPole7m5: f.newPole7m5 !== undefined ? Number(f.newPole7m5) : undefined,
              newPole7m4: f.newPole7m4 !== undefined ? Number(f.newPole7m4) : undefined,
              newPole7m3: f.newPole7m3 !== undefined ? Number(f.newPole7m3) : undefined,
              newPole7m25: f.newPole7m25 !== undefined ? Number(f.newPole7m25) : undefined,
              newPole9m5: f.newPole9m5 !== undefined ? Number(f.newPole9m5) : undefined,
              newPole9m4: f.newPole9m4 !== undefined ? Number(f.newPole9m4) : undefined,
              extPoleLn: f.extPoleLn !== undefined ? Number(f.extPoleLn) : undefined,
              extPoleMti: f.extPoleMti !== undefined ? Number(f.extPoleMti) : undefined,
              extPoleMr: f.extPoleMr !== undefined ? Number(f.extPoleMr) : undefined,
            },
          });
        }
      }
    });

    const updatedProject = await getFullProjectById(id);
    const boqMetrics = calculateBoqMetrics(updatedProject);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PROJECT_UPDATED',
        entityType: 'PROJECT',
        entityId: id,
        details: JSON.stringify({ clusterName: updatedProject.clusterName }),
        ipAddress: req.ip,
      },
    });

    return res.json({
      message: 'Parameter proyek & BoM berhasil disimpan dan disinkronkan.',
      project: updatedProject,
      boqMetrics,
    });
  } catch (err) {
    console.error('Update project error:', err);
    return res.status(500).json({ message: 'Gagal menyimpan perubahan proyek.' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const proj = await prisma.project.findUnique({ where: { id } });
    if (!proj) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, proj)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat menghapus cluster KMZ yang Anda konversi sendiri.',
      });
    }

    await prisma.project.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PROJECT_DELETED',
        entityType: 'PROJECT',
        entityId: id,
        details: JSON.stringify({ clusterCode: proj.clusterCode, clusterName: proj.clusterName }),
        ipAddress: req.ip,
      },
    });

    return res.json({ message: `Proyek ${proj.clusterName} berhasil dihapus.` });
  } catch (err) {
    console.error('Delete project error:', err);
    return res.status(500).json({ message: 'Gagal menghapus proyek.' });
  }
});

// ============================================================================
// EXCEL EXPORT ENDPOINTS (HPDB & BOQ)
// ============================================================================

app.get('/api/projects/:id/export/hpdb', requireAuth, async (req, res) => {
  try {
    const project = await getFullProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat mengunduh cluster KMZ yang Anda konversi sendiri.',
      });
    }

    const wb = await generateHpdbWorkbook(project);
    const buffer = await wb.xlsx.writeBuffer();

    const fileName = `HPDB - ${project.clusterCode} - ${project.clusterName}.xlsx`;

    await prisma.exportHistory.create({
      data: {
        projectId: project.id,
        userId: req.user.id,
        exportType: 'HPDB',
        fileName,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'EXPORT_HPDB',
        entityType: 'PROJECT',
        entityId: project.id,
        details: JSON.stringify({ fileName, totalHomepass: project.totalHomepass }),
        ipAddress: req.ip,
      },
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Export HPDB error:', err);
    return res.status(500).json({ message: 'Gagal mengekspor file Excel HPDB.' });
  }
});

app.get('/api/projects/:id/export/boq', requireAuth, async (req, res) => {
  try {
    if (
      req.user.role !== 'ADMIN' &&
      (req.user.subscriptionPlan === 'BASIC' || !req.user.boqAccessAllowed)
    ) {
      return res.status(403).json({
        code: 'BOQ_NOT_INCLUDED',
        message:
          'Fitur Export BOQ.xlsx tidak termasuk dalam Paket BASIC. Silakan Upgrade ke Paket PRO atau ULTRA melalui QRIS DANA Bisnis.',
      });
    }

    const project = await getFullProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat mengunduh cluster KMZ yang Anda konversi sendiri.',
      });
    }

    const wb = await generateBoqWorkbook(project);
    const buffer = await wb.xlsx.writeBuffer();

    const fileName = `BOQ - ${project.clusterCode} - ${project.clusterName}.xlsx`;

    await prisma.exportHistory.create({
      data: {
        projectId: project.id,
        userId: req.user.id,
        exportType: 'BOQ',
        fileName,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'EXPORT_BOQ',
        entityType: 'PROJECT',
        entityId: project.id,
        details: JSON.stringify({ fileName, totalHomepass: project.totalHomepass }),
        ipAddress: req.ip,
      },
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Export BoQ error:', err);
    return res.status(500).json({ message: 'Gagal mengekspor file Excel BoQ.' });
  }
});

// ============================================================================
// AUTOCAD DWG / DXF EXPORT ENDPOINTS FOR CLUSTERS
// ============================================================================

app.get('/api/projects/:id/export/dwg', requireAuth, async (req, res) => {
  try {
    const project = await getFullProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat mengunduh cluster KMZ yang Anda konversi sendiri.',
      });
    }

    const cadRes = await generateCadFromProject(project);

    // If native AutoCAD DWG binary is available, serve .dwg; otherwise fallback to .dxf
    if (cadRes.dwgBuffer) {
      const fileName = `${project.clusterCode} - ${project.clusterName} - AS PLAN.dwg`;

      await prisma.exportHistory.create({
        data: {
          projectId: project.id,
          userId: req.user.id,
          exportType: 'DWG',
          fileName,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'EXPORT_DWG',
          entityType: 'PROJECT',
          entityId: project.id,
          details: JSON.stringify({ fileName, totalHomepass: project.totalHomepass }),
          ipAddress: req.ip,
        },
      });

      res.setHeader('Content-Type', 'application/acad');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      return res.send(cadRes.dwgBuffer);
    } else {
      const fileName = `${project.clusterCode} - ${project.clusterName} - AS PLAN.dxf`;

      await prisma.exportHistory.create({
        data: {
          projectId: project.id,
          userId: req.user.id,
          exportType: 'DXF',
          fileName,
        },
      });

      res.setHeader('Content-Type', 'application/dxf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      return res.send(cadRes.dxfBuffer);
    }
  } catch (err) {
    console.error('Export DWG error:', err);
    return res.status(500).json({ message: 'Gagal mengekspor file AutoCAD DWG.' });
  }
});

app.get('/api/projects/:id/export/dxf', requireAuth, async (req, res) => {
  try {
    const project = await getFullProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({
        message: 'Akses ditolak. Anda hanya dapat mengunduh cluster KMZ yang Anda konversi sendiri.',
      });
    }

    const cadRes = await generateCadFromProject(project);
    const fileName = `${project.clusterCode} - ${project.clusterName} - AS PLAN.dxf`;

    await prisma.exportHistory.create({
      data: {
        projectId: project.id,
        userId: req.user.id,
        exportType: 'DXF',
        fileName,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'EXPORT_DXF',
        entityType: 'PROJECT',
        entityId: project.id,
        details: JSON.stringify({ fileName, totalHomepass: project.totalHomepass }),
        ipAddress: req.ip,
      },
    });

    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    return res.send(cadRes.dxfBuffer);
  } catch (err) {
    console.error('Export DXF error:', err);
    return res.status(500).json({ message: 'Gagal mengekspor file AutoCAD DXF.' });
  }
});

// Download the sample CONTOH KMZ.kmz file so users can test uploading it anytime
app.get('/api/sample-kmz', requireAuth, (req, res) => {
  const samplePath = path.join(__dirname, '..', 'templates', 'CONTOH_KMZ.kmz');
  if (!fs.existsSync(samplePath)) {
    return res.status(404).json({ message: 'File CONTOH KMZ.kmz tidak ditemukan.' });
  }
  return res.download(samplePath, 'CONTOH KMZ.kmz');
});

// Initialize default payment settings & existing approved users on startup
(async () => {
  try {
    await getOrCreatePaymentSettings();
    const future30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.user.updateMany({
      where: { role: 'ADMIN', subscriptionPlan: 'NONE' },
      data: {
        subscriptionPlan: 'ULTRA',
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: future30d,
        monthlyConvertLimit: -1,
        boqAccessAllowed: true,
      },
    });
    await prisma.user.updateMany({
      where: { role: { not: 'ADMIN' }, status: 'APPROVED', subscriptionPlan: 'NONE' },
      data: {
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: future30d,
        monthlyConvertLimit: 30,
        monthlyConvertUsed: 4,
        boqAccessAllowed: true,
      },
    });
  } catch (err) {
    console.error('Startup subscription init error:', err);
  }
})();

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`FTTH SND Backend Server berjalan pada http://localhost:${PORT}`);
  });
}

module.exports = app;
