/**
 * SQLite datastore via Node's built-in node:sqlite.
 *
 * `BEGIN IMMEDIATE` transactions give the booking engine the
 * ACID guarantees it needs (concurrency-safe slot reservation).
 * The DB file lives on the server; it is never exposed to browsers.
 *
 * Patient PII policy: only the minimum necessary fields are stored
 * (name, mobile, email for contact). NO diagnoses, no clinical history.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

export interface ScheduleRule {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
  duration_min: number;
  buffer_min: number;
  active: number;
}

export interface BlockedPeriod {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  kind: string;
  updated_by: string | null;
  updated_at: string;
}

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const custom = process.env.DATABASE_PATH;
  if (custom) {
    const dir = path.dirname(path.resolve(custom));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(custom);
  } else {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.join(dir, "clinic.db"));
  }
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

/** Run fn inside a BEGIN IMMEDIATE write transaction. */
export function transaction<T>(fn: () => T): T {
  const d = getDb();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    try {
      d.exec("ROLLBACK");
    } catch {
      /* rollback may fail if the txn never started */
    }
    throw e;
  }
}

export function initDb(): void {
  const d = getDb();
  d.exec(`
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_apt_slot
      ON appointments(date, time) WHERE status = 'confirmed';
    CREATE INDEX IF NOT EXISTS idx_apt_date ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_apt_mobile ON appointments(patient_mobile);

    CREATE TABLE IF NOT EXISTS schedule_rules (
      day_of_week INTEGER PRIMARY KEY,
      open_time TEXT,
      close_time TEXT,
      break_start TEXT,
      break_end TEXT,
      duration_min INTEGER NOT NULL DEFAULT 20,
      buffer_min INTEGER NOT NULL DEFAULT 10,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS blocked_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      reason TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'holiday' CHECK(kind IN ('holiday','leave','blocked')),
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create','update','cancel','delete')),
      target TEXT NOT NULL CHECK(target IN ('calendar','sheets')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id TEXT,
      channel TEXT NOT NULL CHECK(channel IN ('email','sms')),
      template TEXT NOT NULL,
      recipient TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT NOT NULL,
      provider_message_id TEXT,
      attempts INTEGER NOT NULL DEFAULT 1,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      session_id TEXT PRIMARY KEY,
      context TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  seedScheduleIfEmpty();
}

/** Default demo schedule — flagged in admin as needing confirmation before launch. */
function seedScheduleIfEmpty(): void {
  const d = getDb();
  const count = (d.prepare("SELECT COUNT(*) AS c FROM schedule_rules").get() as { c: number }).c;
  if (count > 0) return;
  // Mon–Sat, 09:00–20:00 with a lunch break 13:00–16:00.
  // NOTE: these are demo defaults — the clinic confirms real hours in Admin → Schedule.
  transaction(() => {
    const insert = d.prepare(`
      INSERT INTO schedule_rules (day_of_week, open_time, close_time, break_start, break_end, duration_min, buffer_min, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (let dow = 1; dow <= 6; dow++) {
      insert.run(dow, "09:00", "20:00", "13:00", "16:00", 20, 10);
    }
  });
}

export function getScheduleRules(): ScheduleRule[] {
  return getDb().prepare("SELECT * FROM schedule_rules ORDER BY day_of_week").all() as unknown as ScheduleRule[];
}

export function upsertScheduleRule(rule: {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
  duration_min: number;
  buffer_min: number;
  active: boolean | number;
}): void {
  getDb()
    .prepare(
      `INSERT INTO schedule_rules (day_of_week, open_time, close_time, break_start, break_end, duration_min, buffer_min, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day_of_week) DO UPDATE SET
         open_time=excluded.open_time, close_time=excluded.close_time,
         break_start=excluded.break_start, break_end=excluded.break_end,
         duration_min=excluded.duration_min, buffer_min=excluded.buffer_min,
         active=excluded.active`
    )
    .run(
      rule.day_of_week,
      rule.open_time,
      rule.close_time,
      rule.break_start,
      rule.break_end,
      rule.duration_min,
      rule.buffer_min,
      rule.active ? 1 : 0
    );
}

export function getBlockedPeriods(fromDate: string, toDate: string): BlockedPeriod[] {
  return getDb()
    .prepare("SELECT * FROM blocked_periods WHERE date >= ? AND date <= ? ORDER BY date")
    .all(fromDate, toDate) as unknown as BlockedPeriod[];
}

export function addBlockedPeriod(p: {
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  kind: string;
  updated_by: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO blocked_periods (date, start_time, end_time, reason, kind, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(p.date, p.start_time, p.end_time, p.reason, p.kind, p.updated_by, new Date().toISOString());
}

export function removeBlockedPeriod(id: number): void {
  getDb().prepare("DELETE FROM blocked_periods WHERE id = ?").run(id);
}
