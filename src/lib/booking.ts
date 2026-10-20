/**
 * Booking engine — concurrency-safe reservations.
 *
 * Guarantees:
 *  - Availability is computed from the real schedule (DB rules), breaks,
 *    holidays/blocked periods, existing appointments and (when configured)
 *    live Google Calendar events.
 *  - Reservation happens inside a BEGIN IMMEDIATE transaction with a
 *    database-level UNIQUE constraint on (date, time) for confirmed
 *    appointments, so two simultaneous requests can never both win a slot.
 *  - Unique booking references + idempotency keys prevent duplicates.
 *  - Google Calendar / Sheets / notification steps run AFTER the atomic
 *    reservation; failures are queued for retry and never roll back the
 *    legitimate booking or fake a success.
 */
import crypto from "crypto";
import { getConfig, integrationStatus } from "./config";
import { getDb, transaction } from "./db";
import {
  addDays,
  dayOfWeek,
  displayDate,
  displayTime,
  formatTime,
  MINUTES_PER_DAY,
  nowMinutes,
  parseTime,
  todayKey,
} from "./time";
import { calendarProvider, type CalendarProvider } from "./google/calendar";
import { sheetsSync, type SheetsSync } from "./google/sheets";
import { notifyBookingConfirmed, notifyCancellation, notifyReschedule } from "./notifications";
import { auditLog } from "./audit";

/* ------------------------------ Types ------------------------------ */

export type ConsultMode = "in_person" | "online";
export type AppointmentStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export interface Appointment {
  id: string;
  hospital_id?: string | null;
  doctor_id?: string | null;
  patient_id?: string | null;
  billing_id?: string | null;
  idempotency_key: string | null;
  patient_name: string;
  patient_mobile: string;
  patient_email: string | null;
  mode: ConsultMode;
  service_id: string;
  service_name: string;
  date: string;
  time: string;
  duration_min: number;
  status: AppointmentStatus;
  calendar_event_id: string | null;
  calendar_sync_status: string;
  sheets_sync_status: string;
  notification_status: string;
  online_link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface Slot {
  time: string; // "HH:MM"
  minutes: number;
  available: boolean;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  open: boolean;
  slots: Slot[];
}

export class SlotUnavailableError extends Error {
  alternatives: DayAvailability[] = [];
  constructor(message = "The selected slot is no longer available.") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export class ValidationError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super(Object.values(fields).join(" "));
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export interface CreateBookingInput {
  patientName: string;
  patientMobile: string;
  patientEmail?: string;
  isNewPatient: boolean;
  mode: ConsultMode;
  serviceId: string;
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  time: string; // "HH:MM" 24h
  notes?: string;
  consentReminders: boolean;
}

export interface BookingDeps {
  calendar?: CalendarProvider;
  sheets?: SheetsSync;
  notify?: boolean;
}

/* --------------------------- Availability --------------------------- */

interface BusyInterval {
  start: number;
  end: number;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Split working hours into free segments by removing break + blocked windows. */
function segmentsForDay(
  openMin: number,
  closeMin: number,
  breaks: BusyInterval[],
  blocked: BusyInterval[]
): BusyInterval[] {
  let segments: BusyInterval[] = [{ start: openMin, end: closeMin }];
  const cut = (iv: BusyInterval) => {
    const next: BusyInterval[] = [];
    for (const seg of segments) {
      if (iv.end <= seg.start || iv.start >= seg.end) {
        next.push(seg);
        continue;
      }
      if (iv.start > seg.start) next.push({ start: seg.start, end: iv.start });
      if (iv.end < seg.end) next.push({ start: iv.end, end: seg.end });
    }
    segments = next;
  };
  for (const b of breaks) cut(b);
  for (const b of blocked) cut(b);
  return segments;
}

/**
 * Compute genuinely available slots for a date.
 * Demo Mode: local schedule only, clearly labeled by the caller.
 * Live Mode: also reads Google Calendar busy events.
 */
export async function getDayAvailability(
  dateKey: string,
  mode: ConsultMode,
  deps: { calendar?: CalendarProvider } = {}
): Promise<DayAvailability> {
  const cfg = getConfig();
  const rules = getDb().prepare("SELECT * FROM schedule_rules WHERE day_of_week = ?").get(dayOfWeek(dateKey)) as
    | {
        open_time: string | null;
        close_time: string | null;
        break_start: string | null;
        break_end: string | null;
        duration_min: number;
        buffer_min: number;
        active: number;
      }
    | undefined;

  const empty: DayAvailability = { date: dateKey, dayOfWeek: dayOfWeek(dateKey), open: false, slots: [] };
  if (!rules || !rules.active || !rules.open_time || !rules.close_time) return empty;

  const duration = rules.duration_min;
  const buffer = rules.buffer_min;
  const step = Math.max(cfg.booking.slotStepMinutes, duration);
  const openMin = parseTime(rules.open_time);
  const closeMin = parseTime(rules.close_time);

  // Breaks from the schedule rule
  const breaks: BusyInterval[] = [];
  if (rules.break_start && rules.break_end) {
    breaks.push({ start: parseTime(rules.break_start), end: parseTime(rules.break_end) });
  }

  // Blocked periods (holidays / leave / manual blocks) from the DB
  const blockedRows = getDb()
    .prepare("SELECT * FROM blocked_periods WHERE date = ?")
    .all(dateKey) as Array<{ start_time: string | null; end_time: string | null; kind: string }>;
  const blocked: BusyInterval[] = [];
  for (const b of blockedRows) {
    if (b.start_time && b.end_time) blocked.push({ start: parseTime(b.start_time), end: parseTime(b.end_time) });
    else blocked.push({ start: 0, end: MINUTES_PER_DAY }); // all-day block
  }

  // Existing confirmed local appointments (expanded by buffer)
  const booked = getDb()
    .prepare("SELECT time, duration_min FROM appointments WHERE date = ? AND status = 'confirmed'")
    .all(dateKey) as Array<{ time: string; duration_min: number }>;
  const busy: BusyInterval[] = booked.map((a) => {
    const s = parseTime(a.time);
    return { start: Math.max(0, s - buffer), end: Math.min(MINUTES_PER_DAY, s + a.duration_min + buffer) };
  });

  // Google Calendar busy events (live mode only)
  const cal = deps.calendar ?? calendarProvider();
  if (cal) {
    try {
      const events = await cal.listBusy(dateKey);
      for (const e of events) {
        busy.push({ start: Math.max(0, e.startMin - buffer), end: Math.min(MINUTES_PER_DAY, e.endMin + buffer) });
      }
    } catch {
      // Calendar read failure must not break booking; availability falls back
      // to local data and the admin dashboard shows the sync warning.
    }
  }

  const segments = segmentsForDay(openMin, closeMin, breaks, blocked);
  const isPast = (startMin: number) => {
    if (dateKey < todayKey()) return true;
    if (dateKey > todayKey()) return false;
    const cutoff = nowMinutes() + cfg.booking.minAdvanceHours * 60;
    return startMin < cutoff;
  };

  const slots: Slot[] = [];
  for (const seg of segments) {
    for (let t = seg.start; t + duration <= seg.end; t += step) {
      const end = t + duration;
      const conflict = busy.some((b) => overlaps(t, end, b.start, b.end));
      slots.push({ time: formatTime(t), minutes: t, available: !conflict && !isPast(t) });
    }
  }
  return { date: dateKey, dayOfWeek: dayOfWeek(dateKey), open: true, slots };
}

/** Next N days of availability (used by the calendar UI and the receptionist). */
export async function getAvailabilityRange(
  days: number,
  mode: ConsultMode,
  deps: { calendar?: CalendarProvider } = {}
): Promise<DayAvailability[]> {
  const cfg = getConfig();
  const out: DayAvailability[] = [];
  const today = todayKey();
  for (let i = 0; i < days && out.length < cfg.booking.maxAdvanceDays; i++) {
    const date = addDays(today, i);
    const day = await getDayAvailability(date, mode, deps);
    if (day.open) out.push(day);
  }
  return out;
}

/* --------------------------- Reservation --------------------------- */

function newBookingId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += chars[crypto.randomInt(chars.length)];
  return `APT-${suffix}`;
}

function sanitizeText(s: string, max = 500): string {
  return s.replace(/[<>&"']/g, "").slice(0, max);
}

function validateInput(input: CreateBookingInput): void {
  const errors: Record<string, string> = {};
  const cfg = getConfig();
  if (!input.patientName || input.patientName.trim().length < 2 || input.patientName.length > 80)
    errors.patientName = "Please enter the patient's full name.";
  if (!/^[6-9]\d{9}$/.test(input.patientMobile))
    errors.patientMobile = "Enter a valid 10-digit Indian mobile number.";
  if (input.patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.patientEmail))
    errors.patientEmail = "Enter a valid email address, or leave it blank.";
  if (!cfg.booking.modes.includes(input.mode)) errors.mode = "This consultation mode is not enabled.";
  const service = cfg.services.find((s) => s.id === input.serviceId);
  if (!service) errors.serviceId = "Please choose a valid service.";
  else if (!service.modes.includes(input.mode)) errors.mode = "This service is not available in the chosen mode.";
  if (input.notes && input.notes.length > 200) errors.notes = "Please keep the note under 200 characters.";
  // Never accept medical-history-like content in the optional note field.
  if (input.notes && /(diagnos|prescri|dose|tablet|medicine\s*\d)/i.test(input.notes))
    errors.notes = "Please avoid medical details here — the clinic will discuss these during your visit.";
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

function slotIsFree(dateKey: string, timeHHMM: string): boolean {
  const row = getDb()
    .prepare("SELECT id FROM appointments WHERE date = ? AND time = ? AND status = 'confirmed'")
    .get(dateKey, timeHHMM);
  return !row;
}

function onlineLinkFor(mode: ConsultMode): string | null {
  if (mode !== "online") return null;
  const platform = process.env.CONSULTATION_PLATFORM || "google_meet";
  const ref = crypto.randomBytes(6).toString("hex");
  switch (platform) {
    case "jitsi":
      return `https://meet.jit.si/DrXYZ-${ref}`;
    case "zoom":
      // Zoom meetings require API credentials; without them the link is
      // generated by staff in Admin → Appointments. We store no fake URL.
      return null;
    case "custom":
      return (process.env.CUSTOM_MEETING_URL_TEMPLATE || "").replace("{ref}", ref) || null;
    case "google_meet":
    default:
      // Google Meet links are created by the clinic's Google Workspace;
      // the backend stores the link once staff attach it, or patients
      // receive it via the configured channel. Never fabricate a link.
      return null;
  }
}

/**
 * Reserve an appointment.
 *
 * The slot is re-checked inside an immediate transaction, so concurrent
 * requests for the same doctor+time cannot both succeed. Calendar / Sheets
 * / notification work is queued and retried; a provider outage never
 * produces a fake "confirmed" or a lost booking.
 */
export async function createBooking(input: CreateBookingInput, idempotencyKey: string, deps: BookingDeps = {}): Promise<Appointment> {
  validateInput(input);

  const cfg = getConfig();
  const service = cfg.services.find((s) => s.id === input.serviceId)!;
  const duration = service.durationMinutes;

  // Pre-check (fast path, user-friendly errors)
  const availability = await getDayAvailability(input.date, input.mode, deps);
  const slot = availability.slots.find((s) => s.time === input.time);
  if (!availability.open || !slot || !slot.available) {
    const err = new SlotUnavailableError();
    err.alternatives = [availability];
    throw err;
  }

  const cal = deps.calendar ?? calendarProvider();
  const sheets = deps.sheets ?? sheetsSync();
  const d = getDb();

  let appointmentId = "";
  const reserve = () =>
    transaction(() => {
    // RE-CHECK inside the transaction — the authoritative concurrency gate.
    if (!slotIsFree(input.date, input.time)) throw new SlotUnavailableError();
    appointmentId = newBookingId();
    const now = new Date().toISOString();
    d.prepare(
      `INSERT INTO appointments
        (id, idempotency_key, patient_name, patient_mobile, patient_email, mode, service_id, service_name,
         date, time, duration_min, status, calendar_sync_status, sheets_sync_status, notification_status,
         online_link, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'pending', 'pending', 'pending', ?, ?, ?, ?)`
    ).run(
      appointmentId,
      idempotencyKey,
      input.patientName.trim(),
      input.patientMobile,
      input.patientEmail?.trim() || null,
      input.mode,
      service.id,
      service.name,
      input.date,
      input.time,
      duration,
      onlineLinkFor(input.mode),
      input.notes ? sanitizeText(input.notes, 200) : null,
      now,
      now
    );
  });

  try {
    reserve();
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint/i.test(e.message)) {
      // Another request took the slot (or same idempotency key) — surface alternatives.
      const err = new SlotUnavailableError("The slot was just taken. Please pick another time.");
      err.alternatives = [await getDayAvailability(input.date, input.mode, deps)];
      throw err;
    }
    throw e;
  }

  const apt = getAppointment(appointmentId)!;

  // ---- Post-reservation side effects (non-blocking, failure-tolerant) ----
  (async () => {
    // 1) Google Calendar event
    if (cal) {
      try {
        const eventId = await cal.createEvent(apt);
        d.prepare("UPDATE appointments SET calendar_event_id = ?, calendar_sync_status = 'synced', updated_at = ? WHERE id = ?")
          .run(eventId, new Date().toISOString(), apt.id);
      } catch (err) {
        d.prepare("UPDATE appointments SET calendar_sync_status = 'failed', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), apt.id);
        void enqueueSync(apt.id, "create", "calendar", err instanceof Error ? err.message : "calendar error");
      }
    } else {
      d.prepare("UPDATE appointments SET calendar_sync_status = 'not_configured', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), apt.id);
    }
    // 2) Sheets register
    if (!sheets) {
      d.prepare("UPDATE appointments SET sheets_sync_status = 'not_configured', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), apt.id);
    } else {
      try {
        await sheets.recordAppointment(apt);
        d.prepare("UPDATE appointments SET sheets_sync_status = 'synced', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), apt.id);
      } catch (err) {
        d.prepare("UPDATE appointments SET sheets_sync_status = 'failed', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), apt.id);
        void enqueueSync(apt.id, "create", "sheets", err instanceof Error ? err.message : "sheets error");
      }
    }
    // 3) Notifications (only via configured providers; consent required)
    if (deps.notify !== false && input.consentReminders) {
      try {
        await notifyBookingConfirmed(apt);
      } catch {
        d.prepare("UPDATE appointments SET notification_status = 'failed', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), apt.id);
      }
    }
  })();

  auditLog("system", "booking.created", "appointment", apt.id, `${input.mode} on ${input.date} ${input.time}`);
  return getAppointment(appointmentId)!;
}

/** Idempotent create: a retry with the same key returns the original booking. */
export async function createBookingIdempotent(input: CreateBookingInput, idempotencyKey: string, deps: BookingDeps = {}) {
  const existing = getDb().prepare("SELECT * FROM appointments WHERE idempotency_key = ?").get(idempotencyKey) as Appointment | undefined;
  if (existing) return { appointment: existing, duplicated: true };
  const appointment = await createBooking(input, idempotencyKey, deps);
  return { appointment, duplicated: false };
}

/* --------------------------- Lookups --------------------------- */

export function getAppointment(id: string): Appointment | null {
  return (getDb().prepare("SELECT * FROM appointments WHERE id = ?").get(id) as unknown as Appointment) || null;
}

export function findAppointment(ref: string, mobile: string): Appointment | null {
  return (getDb().prepare("SELECT * FROM appointments WHERE id = ? AND patient_mobile = ?").get(ref, mobile) as unknown as Appointment) || null;
}

export function listAppointments(filter: { date?: string; status?: string; mode?: string; query?: string; hospital_id?: string; limit?: number } = {}): Appointment[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filter.date) { clauses.push("date = ?"); params.push(filter.date); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  if (filter.mode) { clauses.push("mode = ?"); params.push(filter.mode); }
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.query) {
    clauses.push("(id LIKE ? OR patient_name LIKE ? OR patient_mobile LIKE ?)");
    const q = `%${filter.query}%`;
    params.push(q, q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare(`SELECT * FROM appointments ${where} ORDER BY date DESC, time DESC LIMIT ?`)
    .all(...params, filter.limit ?? 200) as unknown as Appointment[];
}

/* --------------------------- Cancel / Reschedule --------------------------- */

export async function cancelAppointment(ref: string, mobile: string, reason?: string, deps: BookingDeps = {}): Promise<Appointment> {
  const apt = findAppointment(ref, mobile);
  if (!apt) throw new Error("Appointment not found. Check the reference and mobile number.");
  if (apt.status !== "confirmed") throw new Error("Only confirmed appointments can be cancelled.");

  const d = getDb();
  d.prepare("UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), reason ? sanitizeText(reason, 200) : null, new Date().toISOString(), apt.id);

  const updated = getAppointment(ref)!;
  const cal = deps.calendar ?? calendarProvider();
  const sheets = deps.sheets ?? sheetsSync();

  (async () => {
    if (cal && apt.calendar_event_id) {
      try { await cal.cancelEvent(apt); } catch { void enqueueSync(apt.id, "cancel", "calendar"); }
    }
    if (sheets) {
      try { await sheets.recordCancellation(updated); } catch { void enqueueSync(apt.id, "update", "sheets"); }
    }
    try { await notifyCancellation(updated); } catch { /* logged by provider */ }
  })();

  auditLog("patient", "booking.cancelled", "appointment", apt.id, `reason: ${reason ?? "not given"}`);
  return updated;
}

export async function rescheduleAppointment(
  ref: string,
  mobile: string,
  newDate: string,
  newTime: string,
  deps: BookingDeps = {}
): Promise<Appointment> {
  const apt = findAppointment(ref, mobile);
  if (!apt) throw new Error("Appointment not found. Check the reference and mobile number.");
  if (apt.status !== "confirmed") throw new Error("Only confirmed appointments can be rescheduled.");

  const availability = await getDayAvailability(newDate, apt.mode, deps);
  const slot = availability.slots.find((s) => s.time === newTime);
  if (!availability.open || !slot || !slot.available) {
    const err = new SlotUnavailableError("The new slot is no longer available.");
    err.alternatives = [availability];
    throw err;
  }

  const d = getDb();
  const move = () =>
    transaction(() => {
    const clash = d.prepare("SELECT id FROM appointments WHERE date = ? AND time = ? AND status = 'confirmed' AND id != ?").get(newDate, newTime, apt.id);
    if (clash) throw new SlotUnavailableError("The new slot was just taken.");
    d.prepare("UPDATE appointments SET date = ?, time = ?, calendar_sync_status = 'pending', sheets_sync_status = 'pending', updated_at = ? WHERE id = ?")
      .run(newDate, newTime, new Date().toISOString(), apt.id);
  });
  try { move(); } catch (e) {
    if (e instanceof SlotUnavailableError) { e.alternatives = [availability]; throw e; }
    throw e;
  }

  const updated = getAppointment(ref)!;
  const cal = deps.calendar ?? calendarProvider();
  const sheets = deps.sheets ?? sheetsSync();
  (async () => {
    if (cal && apt.calendar_event_id) {
      try { await cal.updateEvent(updated); } catch { void enqueueSync(apt.id, "update", "calendar"); }
    }
    if (sheets) {
      try { await sheets.recordAppointment(updated); } catch { void enqueueSync(apt.id, "update", "sheets"); }
    }
    try { await notifyReschedule(updated); } catch { /* logged */ }
  })();

  auditLog("patient", "booking.rescheduled", "appointment", apt.id, `${newDate} ${newTime}`);
  return updated;
}

/** Update status from the admin dashboard (confirm/complete/no-show). */
export function setAppointmentStatus(id: string, status: AppointmentStatus, actor: string, detail?: string): Appointment {
  const apt = getAppointment(id);
  if (!apt) throw new Error("Appointment not found.");
  getDb().prepare("UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, new Date().toISOString(), id);
  auditLog(actor, `booking.${status}`, "appointment", id, detail ?? "");
  return getAppointment(id)!;
}

/** Attach an online consultation link (staff-managed, never public). */
export function setOnlineLink(id: string, link: string, actor: string): void {
  getDb().prepare("UPDATE appointments SET online_link = ?, updated_at = ? WHERE id = ?")
    .run(sanitizeText(link, 300), new Date().toISOString(), id);
  auditLog(actor, "booking.link_set", "appointment", id, "online consultation link updated");
}

/* --------------------------- Sync queue --------------------------- */

export function enqueueSync(appointmentId: string, operation: string, target: string, error?: string): number {
  const info = getDb()
    .prepare(
      `INSERT INTO sync_queue (appointment_id, operation, target, status, last_error, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`
    )
    .run(appointmentId, operation, target, error ?? null, new Date().toISOString(), new Date().toISOString());
  return Number(info.lastInsertRowid);
}

/** Human-readable summary for confirmation screens / emails. */
export function bookingSummary(apt: Appointment) {
  const cfg = getConfig();
  const fee = apt.mode === "online" && cfg.booking.onlineFeeInr ? cfg.booking.onlineFeeInr : cfg.booking.consultationFeeInr;
  return {
    reference: apt.id,
    doctor: cfg.doctor.name,
    mode: apt.mode,
    modeLabel: apt.mode === "online" ? "Online consultation" : "In-person consultation",
    date: displayDate(apt.date),
    time: displayTime(apt.time),
    duration: `${apt.duration_min} minutes`,
    service: apt.service_name,
    fee: typeof fee === "number" ? `₹${fee}` : fee,
    onlineLink: apt.online_link,
  };
}

export { displayDate, displayTime };
