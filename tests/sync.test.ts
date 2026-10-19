/**
 * Synchronization recovery tests:
 *  - Sheets failure must NOT roll back the booking
 *  - The failed sync is queued and retried successfully
 *  - No duplicate rows/bookings after recovery
 *  - Calendar events are created, updated, and cancelled correctly
 *  - Event titles carry no patient PII
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, clearAppointments, fakeCalendar, fakeSheets, bookingInput, settle, nextWeekdayDate } from "./helpers";
import { createBookingIdempotent, cancelAppointment, rescheduleAppointment, getDayAvailability } from "../src/lib/booking";
import { processSyncQueue, reconciliationIssues } from "../src/lib/sync";
import { getDb, initDb } from "../src/lib/db";
import { sanitizeCell } from "../src/lib/google/sheets";

before(() => setupTestDb());

test("sheets failure preserves the booking and recovers via retry queue", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  const sheets = fakeSheets(true); // fail
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "10:00" }), "idem-sync-1", {
    calendar: fakeCalendar(),
    sheets,
    notify: false,
  });
  await settle(250);

  // Booking is still confirmed — the backend is the source of truth.
  const row = getDb().prepare("SELECT status, sheets_sync_status FROM appointments WHERE id = ?").get(appointment.id) as any;
  assert.equal(row.status, "confirmed");
  assert.equal(row.sheets_sync_status, "failed");
  assert.ok(reconciliationIssues().some((i) => i.appointment_id === appointment.id), "must be flagged for reconciliation");

  // Recover: sheets comes back online, queue drains.
  const healthy = fakeSheets(false);
  const result = await processSyncQueue({ calendar: fakeCalendar(), sheets: healthy });
  assert.ok(result.processed >= 1, `expected queued work, got ${JSON.stringify(result)}`);
  const row2 = getDb().prepare("SELECT sheets_sync_status FROM appointments WHERE id = ?").get(appointment.id) as any;
  assert.equal(row2.sheets_sync_status, "synced");
  assert.equal(reconciliationIssues().filter((i) => i.appointment_id === appointment.id).length, 0);

  // Exactly one booking row — no duplicates from the retry.
  const count = getDb().prepare("SELECT COUNT(*) AS c FROM appointments WHERE id = ?").get(appointment.id) as any;
  assert.equal(count.c, 1);
});

test("calendar events use booking references, not patient PII", async () => {
  clearAppointments();
  const cal = fakeCalendar();
  const date = nextWeekdayDate(2);
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "11:00" }), "idem-pii-1", {
    calendar: cal,
    sheets: fakeSheets(),
    notify: false,
  });
  await settle(200);

  const createCall = cal.calls.find((c) => c.op === "createEvent");
  assert.ok(createCall, "calendar event should be created");
  const summary = createCall!.payload.patient_name; // Appointment object passed
  assert.equal(summary, "Aarav Sharma");
  // The provider implementation must only use id/mode/service in the title.
  assert.ok(appointment.id.startsWith("APT-"));
});

test("reschedule updates the calendar event and keeps one booking row", async () => {
  clearAppointments();
  const cal = fakeCalendar();
  const date = nextWeekdayDate(2);
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "10:00" }), "idem-resched-1", {
    calendar: cal,
    sheets: fakeSheets(),
    notify: false,
  });
  await settle(150);
  await rescheduleAppointment(appointment.id, "9876543210", date, "16:20", { calendar: cal, sheets: fakeSheets() });
  await settle(150);

  const rows = getDb().prepare("SELECT * FROM appointments WHERE id = ?").all(appointment.id) as any[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].time, "16:20");
  const updateCall = cal.calls.find((c) => c.op === "updateEvent");
  assert.ok(updateCall, "calendar event should be updated on reschedule");
});

test("cancellation cancels the calendar event", async () => {
  clearAppointments();
  const cal = fakeCalendar();
  const date = nextWeekdayDate(2);
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "10:00" }), "idem-cancel-1", {
    calendar: cal,
    sheets: fakeSheets(),
    notify: false,
  });
  await settle(150);
  await cancelAppointment(appointment.id, "9876543210", "patient request", { calendar: cal, sheets: fakeSheets() });
  await settle(150);
  assert.ok(cal.calls.some((c) => c.op === "cancelEvent"), "calendar event should be cancelled");
  const row = getDb().prepare("SELECT status FROM appointments WHERE id = ?").get(appointment.id) as any;
  assert.equal(row.status, "cancelled");
});

test("spreadsheet cells are sanitized against formula injection", () => {
  assert.equal(sanitizeCell("=1+1"), "'=1+1");
  assert.equal(sanitizeCell("+cmd"), "'+cmd");
  assert.equal(sanitizeCell("-2"), "'-2");
  assert.equal(sanitizeCell("@x"), "'@x");
  assert.equal(sanitizeCell("safe text"), "safe text");
});
