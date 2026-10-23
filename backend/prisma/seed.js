const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../src/projectService');

async function main() {
  console.log('Memulai inisialisasi database FTTH SND Pro...');

  // 1. Buat akun Administrator Utama jika belum ada
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ftth-snd.id' },
    update: {},
    create: {
      email: 'admin@ftth-snd.id',
      username: 'admin',
      passwordHash: adminPasswordHash,
      fullName: 'Administrator Utama SND',
      employeeId: 'EMP-SND-001',
      phone: '0811-8899-001',
      department: 'SND FTTH Planning & Engineering',
      region: 'NATIONAL / HEAD OFFICE',
      role: 'ADMIN',
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  });

  // 2. Buat akun Drafter yang sudah di-approve oleh Admin
  const drafterPasswordHash = await bcrypt.hash('Drafter123!', 10);
  await prisma.user.upsert({
    where: { email: 'drafter@ftth-snd.id' },
    update: {},
    create: {
      email: 'drafter@ftth-snd.id',
      username: 'drafter',
      passwordHash: drafterPasswordHash,
      fullName: 'Rizky Pratama (Drafter SND)',
      employeeId: 'EMP-SND-104',
      phone: '0812-3456-7890',
      department: 'SND FTTH Survey & Design',
      region: 'SULAWESI UTARA - KOTAMOBAGU',
      role: 'DRAFTER',
      status: 'APPROVED',
      approvedById: admin.id,
      approvedAt: new Date(),
    },
  });

  // 3. Inisialisasi Pengaturan Pembayaran DANA Bisnis Default
  await prisma.paymentSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      merchantName: 'TOSKA FTTH SND - DANA BISNIS',
      merchantNmid: 'ID1026000088991',
      danaPhoneNumber: '0812-3456-7890',
      autoVerifyMode: true,
      webhookSecret: 'whsec_dana_ftthsnd_2026',
      basicPrice: 100000,
      basicLimit: 10,
      proPrice: 250000,
      proLimit: 30,
      ultraPrice: 500000,
      ultraLimit: -1,
    },
  });

  console.log('Inisialisasi akun & konfigurasi database selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
