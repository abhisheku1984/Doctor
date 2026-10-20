/**
 * SQLite datastore via Node's built-in node:sqlite.
 *
 * Extended hospital management schema with:
 * - Users / RBAC (super_admin, hospital_owner, patient)
 * - Hospitals / Departments / Doctors
 * - Gallery with Drive file IDs
 * - Billing & payments
 * - OTP verifications
 * - Visitor analytics
 * - Extended appointments with hospital/doctor isolation
 *
 * Patient PII policy: only the minimum necessary fields are stored.
 * Google Drive stores media; SQLite is the transactional source of truth.
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

export interface User {
  id: string;
  google_sub: string | null;
  email: string;
  email_verified: number;
  name: string;
  mobile: string | null;
  mobile_verified: number;
  role: string;
  status: string;
  hospital_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  consent_given?: number;
  consent_at?: string | null;
}

export interface Hospital {
  id: string;
  name: string;
  tagline: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  maps_url: string | null;
  emergency_number: string | null;
  description: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  hospital_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  hospital_id: string;
  department_id: string | null;
  name: string;
  title: string | null;
  speciality: string;
  qualifications: string | null; // JSON array
  registration_council: string | null;
  registration_number: string | null;
  experience_years: string | null;
  about: string | null;
  photo_url: string | null;
  photo_drive_id: string | null;
  consultation_fee: number | null;
  online_fee: number | null;
  slot_duration_min: number;
  slot_buffer_min: number;
  max_bookings_per_slot: number;
  modes: string; // JSON array: ["in_person","online"]
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DoctorSchedule {
  id: number;
  doctor_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
  slot_duration_min: number;
  buffer_min: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface GalleryItem {
  id: string;
  hospital_id: string | null;
  category: string;
  title: string | null;
  caption: string | null;
  file_type: string;
  drive_file_id: string | null;
  drive_folder_id: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  display_url: string | null;
  local_path: string | null;
  status: string; // published, draft, archived
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface BillingRecord {
  id: string;
  appointment_id: string | null;
  invoice_number: string;
  hospital_id: string | null;
  patient_id: string | null;
  patient_name: string;
  patient_mobile: string;
  patient_email: string | null;
  items: string; // JSON
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string; // pending, paid, partially_paid, failed, refunded
  payment_method: string | null;
  payment_reference: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  due_date: string | null;
  paid_at: string | null;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsEvent {
  id: number;
  event_id: string;
  event_type: string;
  page: string | null;
  resource_id: string | null;
  resource_type: string | null;
  user_id: string | null;
  session_id: string | null;
  hospital_id: string | null;
  appointment_ref: string | null;
  device_category: string | null;
  outcome: string | null;
  error_code: string | null;
  metadata: string | null;
  created_at: string;
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
  // Step 1: Ensure base appointments table exists with new columns.
  // For fresh DBs, create with full schema. For existing DBs, add missing columns.
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
  `);
  // Migrate old DB: add columns that may be missing
  migrateAppointmentsTable();
  // Now safe to create indexes that reference new columns
  try { d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_apt_slot ON appointments(hospital_id, doctor_id, date, time) WHERE status IN ('confirmed','pending','checked_in');`); } catch {}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_apt_hospital ON appointments(hospital_id);`); } catch {}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_apt_doctor ON appointments(doctor_id);`); } catch {}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_apt_patient ON appointments(patient_id);`); } catch {}
  d.exec(`
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
      doctor_id TEXT,
      hospital_id TEXT,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create','update','cancel','delete')),
      target TEXT NOT NULL CHECK(target IN ('calendar','sheets','drive')),
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
      actor_id TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
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

    -- ============ HOSPITAL MANAGEMENT EXTENSIONS ============

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      phone TEXT,
      email TEXT,
      maps_url TEXT,
      emergency_number TEXT DEFAULT '112',
      description TEXT,
      logo_url TEXT,
      logo_drive_id TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','maintenance')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dept_hospital ON departments(hospital_id);

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      title TEXT,
      speciality TEXT NOT NULL,
      qualifications TEXT,
      registration_council TEXT,
      registration_number TEXT,
      experience_years TEXT,
      about TEXT,
      photo_url TEXT,
      photo_drive_id TEXT,
      consultation_fee REAL,
      online_fee REAL,
      slot_duration_min INTEGER NOT NULL DEFAULT 20,
      slot_buffer_min INTEGER NOT NULL DEFAULT 10,
      max_bookings_per_slot INTEGER NOT NULL DEFAULT 1,
      modes TEXT NOT NULL DEFAULT '["in_person","online"]',
      working_days TEXT,
      working_hours TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','on_leave')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_doctor_hospital ON doctors(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_doctor_dept ON doctors(department_id);
    CREATE INDEX IF NOT EXISTS idx_doctor_speciality ON doctors(speciality);

    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      open_time TEXT,
      close_time TEXT,
      break_start TEXT,
      break_end TEXT,
      slot_duration_min INTEGER NOT NULL DEFAULT 20,
      buffer_min INTEGER NOT NULL DEFAULT 10,
      max_bookings_per_slot INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(doctor_id, day_of_week)
    );
    CREATE INDEX IF NOT EXISTS idx_doc_sched_doctor ON doctor_schedules(doctor_id);

    CREATE TABLE IF NOT EXISTS doctor_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      reason TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'leave' CHECK(kind IN ('holiday','leave','blocked','emergency')),
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_doc_leave_doctor ON doctor_leaves(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_doc_leave_date ON doctor_leaves(date);

    -- Users / Auth
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE,
      email TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      mobile TEXT,
      mobile_verified INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'patient' CHECK(role IN ('super_admin','hospital_owner','patient','staff','doctor')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','suspended','pending_verification')),
      hospital_id TEXT REFERENCES hospitals(id) ON DELETE SET NULL,
      avatar_url TEXT,
      password_hash TEXT,
      consent_given INTEGER DEFAULT 0,
      consent_at TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_mobile ON users(mobile);
    CREATE INDEX IF NOT EXISTS idx_user_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_user_hospital ON users(hospital_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

    -- OTP verifications
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'mobile_verify' CHECK(purpose IN ('mobile_verify','login','password_reset')),
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      expires_at TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_verifications(identifier);

    -- Persistent OTP send limits keyed by a privacy-preserving phone/IP identifier.
    CREATE TABLE IF NOT EXISTS otp_request_limits (
      identifier TEXT PRIMARY KEY,
      window_started_at TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0
    );

    -- Sessions (server-side, for OAuth users)
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_user ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_session_token ON user_sessions(token_hash);

    -- Gallery
    CREATE TABLE IF NOT EXISTS gallery_items (
      id TEXT PRIMARY KEY,
      hospital_id TEXT REFERENCES hospitals(id) ON DELETE SET NULL,
      category TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('general','hospital_images','facilities','events','doctors','videos','banners','awards','infrastructure')),
      title TEXT,
      caption TEXT,
      file_type TEXT NOT NULL DEFAULT 'image' CHECK(file_type IN ('image','video','document')),
      drive_file_id TEXT,
      drive_folder_id TEXT,
      file_name TEXT,
      mime_type TEXT,
      file_size INTEGER,
      thumbnail_url TEXT,
      display_url TEXT,
      local_path TEXT,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','draft','archived')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_hospital ON gallery_items(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery_items(category);
    CREATE INDEX IF NOT EXISTS idx_gallery_status ON gallery_items(status);

    -- Drive sync tracking
    CREATE TABLE IF NOT EXISTS drive_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      drive_folder_id TEXT,
      parent_id TEXT,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drive_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      drive_file_id TEXT,
      gallery_item_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Billing / Invoices
    CREATE TABLE IF NOT EXISTS billing_records (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      hospital_id TEXT REFERENCES hospitals(id) ON DELETE SET NULL,
      patient_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      patient_name TEXT NOT NULL,
      patient_mobile TEXT NOT NULL,
      patient_email TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','partially_paid','failed','refunded','cancelled')),
      payment_method TEXT,
      payment_reference TEXT,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      due_date TEXT,
      paid_at TEXT,
      drive_file_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_billing_hospital ON billing_records(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_billing_patient ON billing_records(patient_id);
    CREATE INDEX IF NOT EXISTS idx_billing_appointment ON billing_records(appointment_id);
    CREATE INDEX IF NOT EXISTS idx_billing_status ON billing_records(status);

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      billing_id TEXT REFERENCES billing_records(id) ON DELETE CASCADE,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','attempted','paid','failed','refunded')),
      method TEXT,
      error_code TEXT,
      error_description TEXT,
      webhook_verified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_payment_billing ON payment_transactions(billing_id);

    -- Visitor Analytics
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      page TEXT,
      resource_id TEXT,
      resource_type TEXT,
      user_id TEXT,
      session_id TEXT,
      hospital_id TEXT,
      appointment_ref TEXT,
      device_category TEXT,
      browser TEXT,
      os TEXT,
      referrer TEXT,
      outcome TEXT,
      error_code TEXT,
      metadata TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_page ON analytics_events(page);
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_hospital ON analytics_events(hospital_id);

    -- Waiting list
    CREATE TABLE IF NOT EXISTS waiting_list (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      doctor_id TEXT,
      date TEXT NOT NULL,
      time TEXT,
      patient_name TEXT NOT NULL,
      patient_mobile TEXT NOT NULL,
      patient_email TEXT,
      patient_id TEXT,
      mode TEXT NOT NULL,
      service_id TEXT,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','notified','booked','expired','cancelled')),
      priority INTEGER DEFAULT 0,
      notified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Announcements / Content
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      hospital_id TEXT REFERENCES hospitals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','draft','archived')),
      published_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Contact / Support
    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved','closed')),
      assigned_to TEXT,
      hospital_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Drive config
    CREATE TABLE IF NOT EXISTS drive_config (
      id TEXT PRIMARY KEY DEFAULT 'default',
      root_folder_id TEXT,
      root_folder_name TEXT DEFAULT 'Hospital_Management_System',
      structure_created INTEGER DEFAULT 0,
      last_sync_at TEXT,
      sync_enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  seedScheduleIfEmpty();
  seedHospitalDefaults();
  migrateAppointmentsTable();
}

/** Migrate old appointment status values to expanded set */
function migrateAppointmentsTable(): void {
  const d = getDb();
  try {
    // Ensure patient_id, hospital_id, doctor_id, billing_id columns exist (for DBs created before this upgrade)
    const cols = d.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    if (!names.includes("patient_id")) d.exec("ALTER TABLE appointments ADD COLUMN patient_id TEXT");
    if (!names.includes("hospital_id")) d.exec("ALTER TABLE appointments ADD COLUMN hospital_id TEXT");
    if (!names.includes("doctor_id")) d.exec("ALTER TABLE appointments ADD COLUMN doctor_id TEXT");
    if (!names.includes("billing_id")) d.exec("ALTER TABLE appointments ADD COLUMN billing_id TEXT");
    // Expand status check constraint - recreate if needed is complex, but SQLite allows any value if constraint not enforced on ALTER
    // We'll handle validation at application layer
  } catch { /* migration best-effort */ }
}

/** Default demo schedule — flagged in admin as needing confirmation before launch. */
function seedScheduleIfEmpty(): void {
  const d = getDb();
  const count = (d.prepare("SELECT COUNT(*) AS c FROM schedule_rules").get() as { c: number }).c;
  if (count > 0) return;
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

function seedHospitalDefaults(): void {
  const d = getDb();
  const existing = (d.prepare("SELECT COUNT(*) AS c FROM hospitals").get() as { c: number }).c;
  if (existing > 0) return;
  const now = new Date().toISOString();
  // Create a default hospital from clinic.json if available
  let hospitalName = "City Care Hospital";
  let hospitalTagline = "Compassionate care, convenient booking.";
  try {
    const fs2 = require("fs");
    const path2 = require("path");
    const cfgPath = path2.join(process.cwd(), "config", "clinic.json");
    if (fs2.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs2.readFileSync(cfgPath, "utf8"));
      if (cfg.clinic?.name && !cfg.clinic.name.includes("[TO BE")) hospitalName = cfg.clinic.name;
      if (cfg.clinic?.tagline) hospitalTagline = cfg.clinic.tagline;
    }
  } catch { /* use defaults */ }

  d.prepare(`INSERT INTO hospitals (id, name, tagline, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
    "hosp_default", hospitalName, hospitalTagline, now, now
  );

  // Seed departments
  const depts = [
    { id: "dept_general", name: "General Medicine", icon: "🩺", desc: "Comprehensive primary care and general consultations" },
    { id: "dept_cardiology", name: "Cardiology", icon: "❤️", desc: "Heart and cardiovascular care" },
    { id: "dept_orthopedics", name: "Orthopedics", icon: "🦴", desc: "Bone, joint and spine care" },
    { id: "dept_pediatrics", name: "Pediatrics", icon: "👶", desc: "Specialized care for infants, children and adolescents" },
    { id: "dept_gynecology", name: "Gynecology", icon: "🤰", desc: "Women's health and maternity care" },
    { id: "dept_dermatology", name: "Dermatology", icon: "✨", desc: "Skin, hair and nail care" },
    { id: "dept_ent", name: "ENT", icon: "👂", desc: "Ear, nose and throat care" },
    { id: "dept_ophthalmology", name: "Ophthalmology", icon: "👁️", desc: "Eye care and vision services" },
  ];
  for (const dept of depts) {
    d.prepare(`INSERT OR IGNORE INTO departments (id, hospital_id, name, description, icon, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`).run(
      dept.id, "hosp_default", dept.name, dept.desc, dept.icon, now, now
    );
  }

  // Seed sample doctors
  const doctors = [
    { id: "doc_001", name: "Dr. Priya Sharma", title: "MBBS, MD", speciality: "General Medicine", dept: "dept_general", fee: 500, exp: "12" },
    { id: "doc_002", name: "Dr. Rajesh Kumar", title: "MBBS, MS", speciality: "Orthopedics", dept: "dept_orthopedics", fee: 800, exp: "15" },
    { id: "doc_003", name: "Dr. Sneha Patel", title: "MBBS, DGO", speciality: "Gynecology", dept: "dept_gynecology", fee: 700, exp: "10" },
    { id: "doc_004", name: "Dr. Arjun Reddy", title: "MBBS, DM", speciality: "Cardiology", dept: "dept_cardiology", fee: 1000, exp: "18" },
  ];
  for (const doc of doctors) {
    d.prepare(`INSERT OR IGNORE INTO doctors (id, hospital_id, department_id, name, title, speciality, qualifications, experience_years, consultation_fee, online_fee, slot_duration_min, slot_buffer_min, max_bookings_per_slot, modes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 20, 10, 1, ?, 'active', ?, ?)`).run(
      doc.id, "hosp_default", doc.dept, doc.name, doc.title, doc.speciality,
      JSON.stringify([doc.title]), doc.exp, doc.fee, doc.fee - 100,
      JSON.stringify(["in_person", "online"]), now, now
    );
    // Create schedule for each doctor Mon-Sat 09:00-18:00
    for (let dow = 1; dow <= 6; dow++) {
      d.prepare(`INSERT OR IGNORE INTO doctor_schedules (doctor_id, day_of_week, open_time, close_time, break_start, break_end, slot_duration_min, buffer_min, max_bookings_per_slot, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 20, 10, 1, 1, ?, ?)`).run(
        doc.id, dow, "09:00", "18:00", "13:00", "14:00", now, now
      );
    }
  }

  // Seed gallery items (local demo images with proper structure)
  const galleryItems = [
    { id: "gal_001", cat: "hospital_images", title: "Modern Hospital Building", caption: "State-of-the-art hospital infrastructure with modern facilities" },
    { id: "gal_002", cat: "facilities", title: "Advanced Operation Theatre", caption: "Fully equipped operation theatre with latest medical technology" },
    { id: "gal_003", cat: "facilities", title: "Diagnostic Laboratory", caption: "Advanced diagnostic lab with automated testing equipment" },
    { id: "gal_004", cat: "hospital_images", title: "Patient Care Ward", caption: "Comfortable and hygienic patient wards with 24/7 nursing care" },
    { id: "gal_005", cat: "events", title: "Health Awareness Camp", caption: "Free health checkup camp organized for the community" },
    { id: "gal_006", cat: "doctors", title: "Expert Medical Team", caption: "Our team of experienced doctors and specialists" },
    { id: "gal_007", cat: "facilities", title: "Emergency Department", caption: "24/7 emergency services with rapid response team" },
    { id: "gal_008", cat: "banners", title: "Welcome to City Care", caption: "Your health is our priority - Visit us today" },
  ];
  const galleryImages = [
    "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1519494140681-8ea454d89f02?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1586776802477-3680284eda45?w=800&h=600&fit=crop",
  ];
  const galleryThumbs = galleryImages.map(u => u.replace("w=800&h=600", "w=400&h=300"));
  for (let i = 0; i < galleryItems.length; i++) {
    const g = galleryItems[i];
    d.prepare(`INSERT OR IGNORE INTO gallery_items (id, hospital_id, category, title, caption, file_type, mime_type, thumbnail_url, display_url, status, sort_order, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, 'image', 'image/jpeg', ?, ?, 'published', ?, ?, ?, ?)`).run(
      g.id, "hosp_default", g.cat, g.title, g.caption, galleryThumbs[i], galleryImages[i], i, now, now, now
    );
  }
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
  doctor_id?: string | null;
  hospital_id?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO blocked_periods (date, start_time, end_time, reason, kind, doctor_id, hospital_id, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(p.date, p.start_time, p.end_time, p.reason, p.kind, p.doctor_id ?? null, p.hospital_id ?? null, p.updated_by, new Date().toISOString());
}

export function removeBlockedPeriod(id: number): void {
  getDb().prepare("DELETE FROM blocked_periods WHERE id = ?").run(id);
}
