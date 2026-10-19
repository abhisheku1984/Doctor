/**
 * Booking engine acceptance tests:
 *  - concurrency-safe reservations (two simultaneous requests)
 *  - idempotency keys
 *  - schedule rules (breaks, closed days, past slots)
 *  - holidays & blocked slots
 *  - input validation & PII minimization
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, clearAppointments, seedConfirmedSlot, fakeCalendar, fakeSheets, bookingInput, settle, nextWeekdayDate } from "./helpers";
import {
  createBooking,
  createBookingIdempotent,
  getDayAvailability,
  SlotUnavailableError,
  ValidationError,
  getAppointment,
  cancelAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
} from "../src/lib/booking";
import { addBlockedPeriod, getDb, initDb } from "../src/lib/db";
import { addDays, todayKey } from "../src/lib/time";

before(() => {
  setupTestDb();
});

test("a valid booking is created and confirmed", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "10:00" }), "idem-1", {
    calendar: fakeCalendar(),
    sheets: fakeSheets(),
    notify: false,
  });
  assert.equal(appointment.status, "confirmed");
  assert.match(appointment.id, /^APT-/);
  assert.equal(appointment.patient_email, "aarav@example.com");
  await settle();
});

test("two simultaneous requests cannot book the same slot", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  const input = bookingInput({ date, time: "11:00" });
  const [a, b] = await Promise.allSettled([
    createBooking(input, "idem-2a", { calendar: fakeCalendar(), sheets: fakeSheets(), notify: false }),
    createBooking(input, "idem-2b", { calendar: fakeCalendar(), sheets: fakeSheets(), notify: false }),
  ]);
  const outcomes = [a, b].map((r) => (r.status === "fulfilled" ? "ok" : r.reason instanceof SlotUnavailableError ? "unavailable" : `error:${r.reason}`));
  assert.equal(outcomes.filter((o) => o === "ok").length, 1, `expected exactly 1 winner, got ${outcomes}`);
  assert.ok(outcomes.includes("unavailable"), `expected a slot-unavailable result, got ${outcomes}`);
});

test("same idempotency key returns the original booking without duplicating", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  const input = bookingInput({ date, time: "12:00" });
  const first = await createBookingIdempotent(input, "idem-3", { calendar: fakeCalendar(), sheets: fakeSheets(), notify: false });
  const second = await createBookingIdempotent(input, "idem-3", { calendar: fakeCalendar(), sheets: fakeSheets(), notify: false });
  assert.equal(second.duplicated, true);
  assert.equal(second.appointment.id, first.appointment.id);
  const rows = getDb().prepare("SELECT COUNT(*) AS c FROM appointments WHERE idempotency_key = 'idem-3'").get() as { c: number };
  assert.equal(rows.c, 1);
});

test("lunch break and closed days are respected in availability", async () => {
  const date = nextWeekdayDate(2); // Tuesday — open
  const day = await getDayAvailability(date, "in_person");
  assert.equal(day.open, true);
  const lunchSlots = day.slots.filter((s) => s.minutes >= 13 * 60 && s.minutes < 16 * 60);
  assert.equal(lunchSlots.length, 0, "no slots should be offered during the 13:00–16:00 break");

  const sunday = nextWeekdayDate(0);
  const closed = await getDayAvailability(sunday, "in_person");
  assert.equal(closed.open, false, "Sunday must be closed per demo schedule");
});

test("existing appointments block overlapping slots (with buffer)", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  seedConfirmedSlot(date, "10:00");
  const day = await getDayAvailability(date, "in_person");
  const byTime = new Map(day.slots.map((s) => [s.time, s.available]));
  // 10:00–10:20 booked with a 10-min buffer → 09:50..10:30 blocked:
  assert.equal(byTime.get("10:00"), false);
  assert.equal(byTime.get("10:20"), false);
  assert.equal(byTime.get("09:40"), false, "09:40–10:00 touches the buffer window");
  assert.equal(byTime.get("09:20"), true, "09:20–09:40 is clear");
  assert.equal(byTime.get("10:40"), true, "10:40 is after the buffered end (10:30)");
});

test("holidays and manually blocked periods are excluded", async () => {
  clearAppointments();
  const date = nextWeekdayDate(3); // Wednesday
  addBlockedPeriod({ date, start_time: "09:00", end_time: "11:00", reason: "Blocked for test", kind: "blocked", updated_by: "test" });
  const day = await getDayAvailability(date, "in_person");
  const morning = day.slots.filter((s) => s.minutes < 11 * 60);
  assert.equal(morning.length, 0, "morning slots must be blocked");
});

test("past dates and past times are unavailable", async () => {
  clearAppointments();
  const yKey = addDays(todayKey(), -1); // Kolkata-aware yesterday
  const day = await getDayAvailability(yKey, "in_person");
  const hasRules = day.open;
  if (hasRules) {
    assert.equal(day.slots.every((s) => !s.available), true, "every slot on a past date must be unavailable");
  }
});

test("invalid inputs are rejected with field errors", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  await assert.rejects(
    () => createBooking(bookingInput({ date, patientMobile: "12345" }), "idem-4", { sheets: fakeSheets(), notify: false }),
    (e: any) => e instanceof ValidationError && !!e.fields.patientMobile
  );
  // Medical notes must not be accepted into the administrative note field.
  await assert.rejects(
    () => createBooking(bookingInput({ date, notes: "I need a prescription for my diabetes medicine" }), "idem-5", { sheets: fakeSheets(), notify: false }),
    (e: any) => e instanceof ValidationError && !!e.fields.notes
  );
});

test("cancelled slots become bookable again", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "17:00" }), "idem-6", {
    calendar: fakeCalendar(), sheets: fakeSheets(), notify: false,
  });
  await cancelAppointment(appointment.id, "9876543210", "patient request");
  const day = await getDayAvailability(date, "in_person");
  const slot = day.slots.find((s) => s.time === "17:00");
  assert.equal(slot?.available, true);
});

test("reschedule moves to a free slot and rejects occupied ones", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "10:00" }), "idem-7", {
    calendar: fakeCalendar(), sheets: fakeSheets(), notify: false,
  });
  await settle();
  const moved = await rescheduleAppointment(appointment.id, "9876543210", date, "16:20");
  assert.equal(moved.time, "16:20");

  seedConfirmedSlot(date, "16:00", "APT-SEED02");
  await assert.rejects(
    () => rescheduleAppointment(appointment.id, "9876543210", date, "16:20"),
    (e: any) => e instanceof SlotUnavailableError
  );
});

test("admin status updates change the record", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  const { appointment } = await createBookingIdempotent(bookingInput({ date, time: "17:00" }), "idem-8", {
    calendar: fakeCalendar(), sheets: fakeSheets(), notify: false,
  });
  await settle();
  const updated = setAppointmentStatus(appointment.id, "completed", "admin-test");
  assert.equal(updated.status, "completed");
  assert.equal(getAppointment(appointment.id)!.status, "completed");
});

test("booking IDs are unique and URL-safe", async () => {
  clearAppointments();
  const date = nextWeekdayDate(2);
  // Pick 5 genuinely free, non-adjacent slots (buffer rules exclude neighbours).
  const day = await getDayAvailability(date, "in_person");
  const free = day.slots.filter((s) => s.available).map((s) => s.time);
  const picked: string[] = [];
  for (const t of free) {
    if (picked.length >= 5) break;
    const [h, m] = t.split(":").map(Number);
    const mins = h * 60 + m;
    const clash = picked.some((p) => {
      const [ph, pm] = p.split(":").map(Number);
      return Math.abs(ph * 60 + pm - mins) < 40; // duration + buffer
    });
    if (!clash) picked.push(t);
  }
  assert.equal(picked.length, 5, "test schedule must offer 5 spaced slots");
  const ids = new Set<string>();
  for (let i = 0; i < picked.length; i++) {
    const { appointment } = await createBookingIdempotent(
      bookingInput({ date, time: picked[i], patientMobile: `98765432${10 + i}` }),
      `idem-unique-${i}`,
      { calendar: fakeCalendar(), sheets: fakeSheets(), notify: false }
    );
    ids.add(appointment.id);
  }
  assert.equal(ids.size, 5);
  for (const id of ids) assert.match(id, /^APT-[A-Z2-9]{8}$/);
});
