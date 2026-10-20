/**
 * Initialize the clinic database.
 * Delegates to src/lib/db.ts so schema stays single-source of truth.
 * Usage: node scripts/init-db.js [--reset]
 */
require('tsx/cjs');
const path = require('path');
const fs = require('fs');

if (process.argv.includes('--reset')) {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'clinic.db');
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix); } catch {}
  }
  console.log('Removed existing database.');
}

const { initDb } = require('../src/lib/db.ts');
initDb();
const { getDb } = require('../src/lib/db.ts');
const count = getDb().prepare('SELECT COUNT(*) as c FROM gallery_items').get().c;
console.log(`Database ready. Gallery items: ${count}`);
