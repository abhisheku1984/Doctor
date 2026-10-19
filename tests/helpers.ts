/**
 * Shared test helpers — every test runs against a throwaway
 * SQLite database so tests never touch real patient data.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { initDb, getDb, transaction } from "../src/lib/db";
import { addDays, todayKey, dayOfWeek } from "../src/lib/time";

export function setupTestDb(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drxyz-test-"));
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = ""; // force Demo Mode
  initDb();
  return tmp;
}

export function nextWeekdayDate(targetDow: number, daysAhead = 1): string {
  // Kolkata-aware date arithmetic (the sandbox may run in UTC).
  let key = addDays(todayKey(), daysAhead);
  while (dayOfWeek(key) !== targetDow) key = addDays(key, 1);
  return key;
}

export function clearAppointments(): void {
  getDb().exec("DELETE FROM appointments");
}

export function seedConfirmedSlot(date: string, time: string, id = "APT-SEED01"): void {
  transaction(() => {
    getDb()
      .prepare(
        `INSERT INTO appointments (id, idempotency_key, patient_name, patient_mobile, mode, service_id,
         service_name, date, time, duration_min, status, calendar_sync_status, sheets_sync_status,
         notification_status, created_at, updated_at)
         VALUES (?, ?, 'Test Patient', '9876543210', 'in_person', 'gp-consult', 'General Consultation',
                 ?, ?, 20, 'confirmed', 'not_configured', 'not_configured', 'pending', ?, ?)`
      )
      .run(id, `test-${id}`, date, time, new Date().toISOString(), new Date().toISOString());
  });
}

/** Fake calendar provider that records calls. */
export function fakeCalendar() {
  const calls: Array<{ op: string; payload?: any }> = [];
  let eventSeq = 0;
  return {
    calls,
    async listBusy(_date: string) {
      calls.push({ op: "listBusy" });
      return [];
    },
    async createEvent(apt: any) {
      calls.push({ op: "createEvent", payload: apt });
      return `evt-${++eventSeq}`;
    },
    async updateEvent(apt: any) {
      calls.push({ op: "updateEvent", payload: apt });
    },
    async cancelEvent(apt: any) {
      calls.push({ op: "cancelEvent", payload: apt });
    },
  };
}

/** Fake sheets sync that can be toggled to fail. */
export function fakeSheets(shouldFail = false) {
  const calls: Array<{ op: string; row?: any }> = [];
  return {
    calls,
    setFail(v: boolean) {
      (this as any)._fail = v;
    },
    async recordAppointment(apt: any) {
      calls.push({ op: "recordAppointment", row: apt });
      if (shouldFail) throw new Error("sheets API unavailable (simulated)");
    },
    async recordCancellation(apt: any) {
      calls.push({ op: "recordCancellation", row: apt });
      if (shouldFail) throw new Error("sheets API unavailable (simulated)");
    },
    async recordStatusChange(apt: any) {
      calls.push({ op: "recordStatusChange", row: apt });
      if (shouldFail) throw new Error("sheets API unavailable (simulated)");
    },
    async syncScheduleSheet() {},
    async syncBlockedSheet() {},
    async writeSummarySheet() {},
    async appendRow() {},
  };
}

export function bookingInput(overrides: Record<string, unknown> = {}) {
  return {
    patientName: "Aarav Sharma",
    patientMobile: "9876543210",
    patientEmail: "aarav@example.com",
    isNewPatient: true,
    mode: "in_person" as const,
    serviceId: "gp-consult",
    date: nextWeekdayDate(2), // a Tuesday
    time: "10:00",
    consentReminders: true,
    ...overrides,
  };
}

/** Wait for booking's async side effects to settle. */
export function settle(ms = 120): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
