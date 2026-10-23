/**
 * Helper to push schema & seed to Neon Cloud Database from local machine
 * without modifying local dev.db!
 * Usage: node scripts/push-cloud.js "postgresql://..."
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cloudUrl = process.argv[2] || process.env.CLOUD_DATABASE_URL;
if (!cloudUrl || (!cloudUrl.startsWith('postgres://') && !cloudUrl.startsWith('postgresql://'))) {
  console.error('\n❌ Masukkan connection string Neon PostgreSQL.');
  console.error('Contoh penggunaan:');
  console.error('  node scripts/push-cloud.js "postgresql://neondb_owner:password@ep-xyz.aws.neon.tech/neondb?sslmode=require"\n');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let originalSchema = fs.readFileSync(schemaPath, 'utf8');

try {
  console.log('1. Mengubah provider sementara ke PostgreSQL...');
  const pgSchema = originalSchema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, pgSchema, 'utf8');

  console.log('2. Mendorong schema ke Neon Cloud Database...');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: cloudUrl },
  });

  if (process.argv.includes('--seed')) {
    console.log('3. Melakukan seeding data awal ke Cloud...');
    execSync('node prisma/seed.js', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: cloudUrl },
    });
  }

  console.log('\n✅ Database Cloud Neon berhasil disiapkan!');
} catch (err) {
  console.error('\n❌ Terjadi kesalahan saat sinkronisasi ke cloud:', err.message);
} finally {
  console.log('4. Mengembalikan schema lokal ke SQLite (Localhost tetap aman di dev.db)...');
  fs.writeFileSync(schemaPath, originalSchema, 'utf8');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Localhost kembali menggunakan SQLite dev.db lokal 100%!');
}
