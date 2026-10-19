/**
 * Initialize the clinic database (creates tables + demo schedule).
 * Usage: node scripts/init-db.js [--reset]
 */
const path = require("path");
const fs = require("fs");

// Minimal bootstrap so we can import the TS lib via a tiny loader shim.
// For production: run `npm run db:init` before first start.
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Use node:sqlite directly to avoid TS compilation here.
const { DatabaseSync } = require("node:sqlite");
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "clinic.db");

if (process.argv.includes("--reset") && fs.existsSync(dbPath)) {
  fs.rmSync(dbPath);
  console.log("Removed existing database.");
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE,
    patient_name TEXT NOT NULL,
    patient_mobile TEXT NOT NULL,
    patient_email TEXT,
    mode TEXT NOT NULL CHECK(mode IN ('in_person','online')),
    service_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','completed','no_show')),
    calendar_event_id TEXT,
    calendar_sync_status TEXT NOT NULL DEFAULT 'pending',
    sheets_sync_status TEXT NOT NULL DEFAULT 'pending',
    notification_status TEXT NOT NULL DEFAULT 'pending',
    online_link TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cancelled_at TEXT,
    cancel_reason TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_apt_slot ON appointments(date, time) WHERE status = 'confirmed';
  CREATE INDEX IF NOT EXISTS idx_apt_date ON appointments(date);
  CREATE INDEX IF NOT EXISTS idx_apt_mobile ON appointments(patient_mobile);

  CREATE TABLE IF NOT EXISTS schedule_rules (
    day_of_week INTEGER PRIMARY KEY,
    open_time TEXT, close_time TEXT, break_start TEXT, break_end TEXT,
    duration_min INTEGER NOT NULL DEFAULT 20, buffer_min INTEGER NOT NULL DEFAULT 10,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS blocked_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, start_time TEXT, end_time TEXT,
    reason TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'holiday' CHECK(kind IN ('holiday','leave','blocked')),
    updated_by TEXT, updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id TEXT NOT NULL, operation TEXT NOT NULL,
    target TEXT NOT NULL CHECK(target IN ('calendar','sheets')),
    attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id TEXT, channel TEXT NOT NULL CHECK(channel IN ('email','sms')),
    template TEXT NOT NULL, recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', provider TEXT NOT NULL,
    provider_message_id TEXT, attempts INTEGER NOT NULL DEFAULT 1,
    last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL, action TEXT NOT NULL,
    entity TEXT, entity_id TEXT, details TEXT, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY, context TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const count = db.prepare("SELECT COUNT(*) AS c FROM schedule_rules").get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO schedule_rules (day_of_week, open_time, close_time, break_start, break_end, duration_min, buffer_min, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  for (let dow = 1; dow <= 6; dow++) {
    insert.run(dow, "09:00", "20:00", "13:00", "16:00", 20, 10);
  }
  console.log("Seeded demo schedule (Mon–Sat 09:00–20:00, lunch 13:00–16:00).");
}

console.log(`Database ready at ${dbPath}`);
