/**
 * Hospital, Department, Doctor management
 */
import crypto from "crypto";
import { getDb } from "./db";
import type { Hospital, Department, Doctor } from "./db";
import { auditLog } from "./audit";

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

// ---- Hospitals ----

export function listHospitals(opts: { status?: string; search?: string } = {}): Hospital[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.status) { clauses.push("status = ?"); params.push(opts.status); }
  if (opts.search) { clauses.push("(name LIKE ? OR city LIKE ?)"); const q = `%${opts.search}%`; params.push(q, q); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb().prepare(`SELECT * FROM hospitals ${where} ORDER BY created_at DESC`).all(...params as any[]) as unknown as Hospital[];
}

export function getHospital(id: string): Hospital | null {
  return (getDb().prepare("SELECT * FROM hospitals WHERE id = ?").get(id) as unknown as Hospital) || null;
}

export function getDefaultHospital(): Hospital | null {
  return getHospital("hosp_default");
}

export function createHospital(input: Partial<Hospital> & { name: string }, actor?: string): Hospital {
  const id = input.id || genId("hosp");
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO hospitals (id, name, tagline, address, city, state, pincode, phone, email, maps_url, emergency_number, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.name, input.tagline ?? null, input.address ?? null, input.city ?? null,
    input.state ?? null, input.pincode ?? null, input.phone ?? null, input.email ?? null,
    input.maps_url ?? null, input.emergency_number ?? "112", input.description ?? null,
    input.status ?? "active", now, now
  );
  if (actor) auditLog(actor, "hospital.created", "hospital", id, input.name);
  return getHospital(id)!;
}

export function updateHospital(id: string, updates: Partial<Hospital>, actor?: string): Hospital {
  const hosp = getHospital(id);
  if (!hosp) throw new Error("Hospital not found.");
  const fields: string[] = [];
  const vals: unknown[] = [];
  const updatable = ["name", "tagline", "address", "city", "state", "pincode", "phone", "email", "maps_url", "emergency_number", "description", "status", "logo_url"] as const;
  for (const k of updatable) {
    if (updates[k] !== undefined) { fields.push(`${k} = ?`); vals.push(updates[k]); }
  }
  if (!fields.length) return hosp;
  fields.push("updated_at = ?"); vals.push(new Date().toISOString());
  vals.push(id);
  getDb().prepare(`UPDATE hospitals SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as any[]));
  if (actor) auditLog(actor, "hospital.updated", "hospital", id);
  return getHospital(id)!;
}

// ---- Departments ----

export function listDepartments(hospitalId: string): Department[] {
  return getDb().prepare("SELECT * FROM departments WHERE hospital_id = ? ORDER BY sort_order, name").all(hospitalId) as unknown as Department[];
}

export function getDepartment(id: string): Department | null {
  return (getDb().prepare("SELECT * FROM departments WHERE id = ?").get(id) as unknown as Department) || null;
}

export function createDepartment(input: { hospital_id: string; name: string; description?: string; icon?: string }, actor?: string): Department {
  const id = genId("dept");
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO departments (id, hospital_id, name, description, icon, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`)
    .run(id, input.hospital_id, input.name, input.description ?? null, input.icon ?? null, now, now);
  if (actor) auditLog(actor, "department.created", "department", id, input.name);
  return getDepartment(id)!;
}

export function updateDepartment(id: string, updates: Partial<Department>, actor?: string): Department {
  const dept = getDepartment(id);
  if (!dept) throw new Error("Department not found.");
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const k of ["name", "description", "icon", "status"] as const) {
    if (updates[k] !== undefined) { fields.push(`${k} = ?`); vals.push(updates[k]); }
  }
  if (!fields.length) return dept;
  fields.push("updated_at = ?"); vals.push(new Date().toISOString());
  vals.push(id);
  getDb().prepare(`UPDATE departments SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as any[]));
  return getDepartment(id)!;
}

export function deleteDepartment(id: string, actor?: string): void {
  getDb().prepare("DELETE FROM departments WHERE id = ?").run(id);
  if (actor) auditLog(actor, "department.deleted", "department", id);
}

// ---- Doctors ----

export function listDoctors(filter: { hospital_id?: string; department_id?: string; speciality?: string; status?: string; search?: string; limit?: number } = {}): Doctor[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.department_id) { clauses.push("department_id = ?"); params.push(filter.department_id); }
  if (filter.speciality) { clauses.push("speciality = ?"); params.push(filter.speciality); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  if (filter.search) {
    clauses.push("(name LIKE ? OR speciality LIKE ?)");
    const q = `%${filter.search}%`; params.push(q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  return getDb().prepare(`SELECT * FROM doctors ${where} ORDER BY name LIMIT ?`).all(...params as any[], limit) as unknown as Doctor[];
}

export function getDoctor(id: string): Doctor | null {
  return (getDb().prepare("SELECT * FROM doctors WHERE id = ?").get(id) as unknown as Doctor) || null;
}

export function createDoctor(input: Partial<Doctor> & { name: string; speciality: string; hospital_id: string }, actor?: string): Doctor {
  const id = input.id || genId("doc");
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO doctors (id, hospital_id, department_id, name, title, speciality, qualifications, registration_council, registration_number, experience_years, about, photo_url, photo_drive_id, consultation_fee, online_fee, slot_duration_min, slot_buffer_min, max_bookings_per_slot, modes, working_days, working_hours, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.hospital_id, input.department_id ?? null, input.name, input.title ?? null,
    input.speciality, input.qualifications ?? null, input.registration_council ?? null,
    input.registration_number ?? null, input.experience_years ?? null, input.about ?? null,
    input.photo_url ?? null, input.photo_drive_id ?? null,
    input.consultation_fee ?? null, input.online_fee ?? null,
    input.slot_duration_min ?? 20, input.slot_buffer_min ?? 10,
    input.max_bookings_per_slot ?? 1,
    input.modes ?? JSON.stringify(["in_person", "online"]),
    (input as any).working_days ?? null, (input as any).working_hours ?? null,
    input.status ?? "active", now, now
  );
  // Create default schedule for doctor
  for (let dow = 1; dow <= 6; dow++) {
    try {
      getDb().prepare(`INSERT OR IGNORE INTO doctor_schedules (doctor_id, day_of_week, open_time, close_time, break_start, break_end, slot_duration_min, buffer_min, max_bookings_per_slot, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
        id, dow, "09:00", "18:00", "13:00", "14:00", 20, 10, 1, now, now
      );
    } catch { /* ignore */ }
  }
  if (actor) auditLog(actor, "doctor.created", "doctor", id, input.name);
  return getDoctor(id)!;
}

export function updateDoctor(id: string, updates: Record<string, unknown>, actor?: string): Doctor {
  const doc = getDoctor(id);
  if (!doc) throw new Error("Doctor not found.");
  const allowed = ["name", "title", "speciality", "qualifications", "registration_council", "registration_number", "experience_years", "about", "photo_url", "photo_drive_id", "consultation_fee", "online_fee", "slot_duration_min", "slot_buffer_min", "max_bookings_per_slot", "modes", "department_id", "status"] as const;
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const k of allowed) {
    if (updates[k] !== undefined) {
      fields.push(`${k} = ?`);
      vals.push(updates[k]);
    }
  }
  if (!fields.length) return doc;
  fields.push("updated_at = ?"); vals.push(new Date().toISOString());
  vals.push(id);
  getDb().prepare(`UPDATE doctors SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as any[]));
  if (actor) auditLog(actor, "doctor.updated", "doctor", id);
  return getDoctor(id)!;
}

export function deleteDoctor(id: string, actor?: string): void {
  getDb().prepare("DELETE FROM doctors WHERE id = ?").run(id);
  if (actor) auditLog(actor, "doctor.deleted", "doctor", id);
}

// ---- Doctor schedules ----

export function getDoctorSchedules(doctorId: string) {
  return getDb().prepare("SELECT * FROM doctor_schedules WHERE doctor_id = ? ORDER BY day_of_week").all(doctorId);
}

export function upsertDoctorSchedule(doctorId: string, rule: {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
  slot_duration_min?: number;
  buffer_min?: number;
  max_bookings_per_slot?: number;
  active?: boolean;
}): void {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO doctor_schedules (doctor_id, day_of_week, open_time, close_time, break_start, break_end, slot_duration_min, buffer_min, max_bookings_per_slot, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(doctor_id, day_of_week) DO UPDATE SET
      open_time=excluded.open_time, close_time=excluded.close_time,
      break_start=excluded.break_start, break_end=excluded.break_end,
      slot_duration_min=excluded.slot_duration_min, buffer_min=excluded.buffer_min,
      max_bookings_per_slot=excluded.max_bookings_per_slot, active=excluded.active, updated_at=excluded.updated_at
  `).run(
    doctorId, rule.day_of_week, rule.open_time, rule.close_time, rule.break_start, rule.break_end,
    rule.slot_duration_min ?? 20, rule.buffer_min ?? 10, rule.max_bookings_per_slot ?? 1,
    rule.active !== false ? 1 : 0, now, now
  );
}

export function getDoctorLeaves(doctorId: string, fromDate: string, toDate: string) {
  return getDb().prepare("SELECT * FROM doctor_leaves WHERE doctor_id = ? AND date >= ? AND date <= ? ORDER BY date").all(doctorId, fromDate, toDate);
}

export function addDoctorLeave(input: { doctor_id: string; date: string; start_time?: string | null; end_time?: string | null; reason: string; kind?: string; created_by?: string }): void {
  getDb().prepare(`INSERT INTO doctor_leaves (doctor_id, date, start_time, end_time, reason, kind, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.doctor_id, input.date, input.start_time ?? null, input.end_time ?? null, input.reason, input.kind ?? "leave", input.created_by ?? null, new Date().toISOString());
}

export function removeDoctorLeave(id: number): void {
  getDb().prepare("DELETE FROM doctor_leaves WHERE id = ?").run(id);
}
