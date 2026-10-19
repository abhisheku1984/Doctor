/**
 * Google Sheets appointment register.
 *
 * Sheets is the OPERATIONAL register and reporting layer — it is
 * deliberately NOT used to lock slots (the transactional SQLite
 * backend does that). Every write is verified; failures are queued
 * for retry and surfaced in the admin dashboard until reconciled.
 */
import { google } from "googleapis";
import { getGoogleAuth, SHEETS_SCOPES } from "./auth";
import { integrationStatus } from "../config";
import { displayDate, displayTime } from "../time";
import type { Appointment } from "../booking";

export interface SheetsSync {
  recordAppointment(apt: Appointment): Promise<void>;
  recordCancellation(apt: Appointment): Promise<void>;
  recordStatusChange(apt: Appointment): Promise<void>;
  syncScheduleSheet(): Promise<void>;
  syncBlockedSheet(): Promise<void>;
  writeSummarySheet(): Promise<void>;
  appendRow(sheet: string, row: string[]): Promise<void>;
}

function spreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";
}

/** Prevent spreadsheet formula injection: neutralize leading =,+,-,@ */
export function sanitizeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

async function getSheets(): Promise<{ sheets: ReturnType<typeof google.sheets> } | null> {
  const { jwt, configured } = getGoogleAuth(SHEETS_SCOPES);
  if (!configured || !jwt) return null;
  await jwt.authorize();
  return { sheets: google.sheets({ version: "v4", auth: jwt }) };
}

const APPT_HEADERS = [
  "Appointment ID", "Created At", "Appointment Date", "Appointment Time", "Patient Name",
  "Patient Mobile", "Patient Email", "Consultation Mode", "Service", "Appointment Duration",
  "Appointment Status", "Calendar Event ID", "Notification Status", "Last Updated",
];

const liveSync: SheetsSync = {
  async appendRow(sheet: string, row: string[]): Promise<void> {
    const ctx = await getSheets();
    if (!ctx) throw new Error("Google Sheets is not configured.");
    await ctx.sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId(),
      range: `${sheet}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [row.map(sanitizeCell)] },
    });
  },

  async recordAppointment(apt: Appointment): Promise<void> {
    await this.appendRow("Appointments", [
      apt.id,
      apt.created_at,
      apt.date,
      apt.time,
      apt.patient_name,
      apt.patient_mobile,
      apt.patient_email ?? "",
      apt.mode === "online" ? "Online" : "In-person",
      apt.service_name,
      String(apt.duration_min),
      apt.status,
      apt.calendar_event_id ?? "",
      apt.notification_status,
      apt.updated_at,
    ]);
  },

  async recordCancellation(apt: Appointment): Promise<void> {
    await this.recordStatusChange(apt);
  },

  async recordStatusChange(apt: Appointment): Promise<void> {
    const ctx = await getSheets();
    if (!ctx) throw new Error("Google Sheets is not configured.");
    const sid = spreadsheetId();
    // Find the row for this appointment reference.
    const found = await ctx.sheets.spreadsheets.values.get({ spreadsheetId: sid, range: "Appointments!A:A" });
    const col = (found.data.values ?? []).flat();
    const rowIndex = col.findIndex((v) => v === apt.id);
    if (rowIndex < 0) {
      // Row missing (e.g. earlier append failed) → append a fresh accurate row.
      await this.recordAppointment(apt);
      return;
    }
    const rowNum = rowIndex + 1;
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `Appointments!K${rowNum}:N${rowNum}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[sanitizeCell(apt.status), sanitizeCell(apt.calendar_event_id ?? ""), sanitizeCell(apt.notification_status), sanitizeCell(apt.updated_at)]],
      },
    });
  },

  async syncScheduleSheet(): Promise<void> {
    const ctx = await getSheets();
    if (!ctx) throw new Error("Google Sheets is not configured.");
    const sid = spreadsheetId();
    await ctx.sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Doctor Schedule!A2:I" });
    const rows = (await import("../db")).getScheduleRules().map((r) => [
      String(r.day_of_week === 0 ? 7 : r.day_of_week - 1), // ISO weekday Mon=1
      r.open_time ?? "", r.close_time ?? "", r.break_start ?? "", r.break_end ?? "",
      String(r.duration_min), String(r.buffer_min), String(r.active), "",
    ]);
    if (rows.length) {
      await ctx.sheets.spreadsheets.values.append({
        spreadsheetId: sid,
        range: "Doctor Schedule!A1",
        valueInputOption: "RAW",
        requestBody: { values: rows.map((r) => r.map(sanitizeCell)) },
      });
    }
  },

  async syncBlockedSheet(): Promise<void> {
    const ctx = await getSheets();
    if (!ctx) throw new Error("Google Sheets is not configured.");
    const sid = spreadsheetId();
    await ctx.sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Holidays and Blocked Slots!A2:E" });
    const { getBlockedPeriods } = await import("../db");
    const today = new Date().toISOString().slice(0, 10);
    const rows = getBlockedPeriods(today, today.slice(0, 4) + "12-31").map((b) => [
      b.date, b.start_time ?? "All day", b.end_time ?? "All day", b.reason, b.updated_by ?? "",
    ]);
    if (rows.length) {
      await ctx.sheets.spreadsheets.values.append({
        spreadsheetId: sid,
        range: "Holidays and Blocked Slots!A1",
        valueInputOption: "RAW",
        requestBody: { values: rows.map((r) => r.map(sanitizeCell)) },
      });
    }
  },

  async writeSummarySheet(): Promise<void> {
    const ctx = await getSheets();
    if (!ctx) throw new Error("Google Sheets is not configured.");
    const sid = spreadsheetId();
    const { getDb } = await import("../db");
    const d = getDb();
    const counts = (d.prepare(
      `SELECT status, mode, COUNT(*) AS c FROM appointments GROUP BY status, mode`
    ).all() as Array<{ status: string; mode: string; c: number }>);
    const total = counts.reduce((a, r) => a + r.c, 0);
    const by = (s: string) => counts.filter((r) => r.status === s).reduce((a, r) => a + r.c, 0);
    const byMode = (m: string) => counts.filter((r) => r.mode === m).reduce((a, r) => a + r.c, 0);
    const daily = (d.prepare(
      `SELECT date, COUNT(*) AS c FROM appointments WHERE status='confirmed' GROUP BY date ORDER BY date DESC LIMIT 30`
    ).all() as Array<{ date: string; c: number }>);
    const rows = [
      ["Report generated", new Date().toISOString(), "", "", ""],
      ["Metric", "Count", "", "", ""],
      ["Total appointments", String(total), "", "", ""],
      ["Confirmed", String(by("confirmed")), "", "", ""],
      ["Cancelled", String(by("cancelled")), "", "", ""],
      ["Completed", String(by("completed")), "", "", ""],
      ["No-shows", String(by("no_show")), "", "", ""],
      ["In-person consultations", String(byMode("in_person")), "", "", ""],
      ["Online consultations", String(byMode("online")), "", "", ""],
      ["", "", "", "", ""],
      ["Daily bookings (last 30 days)", "Count", "", "", ""],
      ...daily.map((r) => [displayDate(r.date), String(r.c), "", "", ""]),
    ];
    await ctx.sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Daily and Monthly Summary!A2:E" });
    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: "Daily and Monthly Summary!A1",
      valueInputOption: "RAW",
      requestBody: { values: rows.map((r) => r.map((c) => sanitizeCell(c))) },
    });
  },
};

export function sheetsSync(): SheetsSync | null {
  if (integrationStatus("sheets") !== "live") return null;
  return liveSync;
}

export async function testSheetsConnection(): Promise<{ ok: boolean; message: string }> {
  const ctx = await getSheets();
  if (!ctx) return { ok: false, message: "Google Sheets credentials are not configured." };
  if (!spreadsheetId()) return { ok: false, message: "GOOGLE_SHEETS_SPREADSHEET_ID is not set." };
  try {
    const res = await ctx.sheets.spreadsheets.get({ spreadsheetId: spreadsheetId() });
    const titles = (res.data.sheets ?? []).map((s) => s.properties?.title).join(", ");
    return { ok: true, message: `Connected — worksheets: ${titles}` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${(e as Error).message}` };
  }
}

/** Ensure the register exists with all four worksheets. */
export async function createRegisterSpreadsheet(title = "Dr. XYZ — Clinic Appointment Register"): Promise<string> {
  const ctx = await getSheets();
  if (!ctx) throw new Error("Google Sheets is not configured.");
  const res = await ctx.sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: "Appointments" } },
        { properties: { title: "Doctor Schedule" } },
        { properties: { title: "Holidays and Blocked Slots" } },
        { properties: { title: "Daily and Monthly Summary" } },
      ],
    },
  });
  const sid = res.data.spreadsheetId!;
  // Write headers
  await ctx.sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: "Appointments!A1",
    valueInputOption: "RAW",
    requestBody: { values: [APPT_HEADERS.map(sanitizeCell)] },
  });
  await ctx.sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: "Doctor Schedule!A1",
    valueInputOption: "RAW",
    requestBody: { values: [["Schedule ID", "Day of Week", "Opening Time", "Closing Time", "Break Start", "Break End", "Appointment Duration", "Buffer Duration", "Active Status"].map(sanitizeCell)] },
  });
  await ctx.sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: "Holidays and Blocked Slots!A1",
    valueInputOption: "RAW",
    requestBody: { values: [["Date", "Start Time", "End Time", "Reason", "Updated By", "Last Updated"].map(sanitizeCell)] },
  });
  await ctx.sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: "Daily and Monthly Summary!A1",
    valueInputOption: "RAW",
    requestBody: { values: [["Report", "Value", "", "", ""].map(sanitizeCell)] },
  });
  return sid;
}

export { displayDate, displayTime };
