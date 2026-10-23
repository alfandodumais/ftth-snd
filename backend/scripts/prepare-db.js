const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
if (fs.existsSync(schemaPath)) {
  let schema = fs.readFileSync(schemaPath, 'utf8');
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

  if (isPostgres) {
    schema = schema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, 'provider = "postgresql"');
    console.log('[Prisma] Database Provider: PostgreSQL (Cloud / Production)');
  } else {
    schema = schema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, 'provider = "sqlite"');
    console.log('[Prisma] Database Provider: SQLite (Localhost / dev.db)');
  }
  fs.writeFileSync(schemaPath, schema, 'utf8');
}
