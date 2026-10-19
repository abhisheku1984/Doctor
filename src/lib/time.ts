/**
 * Time utilities — every time in this system is Asia/Kolkata.
 * All date math uses minute-of-day integers to avoid DST/locale pitfalls.
 */
import { TIMEZONE } from "./config";

export const MINUTES_PER_DAY = 24 * 60;

/** Current wall-clock time in the clinic timezone. */
export function nowKolkata(): Date {
  const iso = new Date().toLocaleString("en-US", { timeZone: TIMEZONE });
  return new Date(iso);
}

/** YYYY-MM-DD of a Date in the clinic timezone. */
export function kolkataDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** Current clinic date key. */
export function todayKey(): string {
  return kolkataDateKey(new Date());
}

/** Current minute-of-day in the clinic timezone. */
export function nowMinutes(): number {
  const d = nowKolkata();
  return d.getHours() * 60 + d.getMinutes();
}

/** "HH:MM" → minutes since midnight. */
export function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes since midnight → "HH:MM". */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → "9:30 AM" for display. */
export function displayTime(t: string): string {
  const mins = parseTime(t);
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "YYYY-MM-DD" → "Mon, 12 Oct 2026" (clinic timezone). */
export function displayDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00+05:30`);
  return d.toLocaleDateString("en-IN", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/**
 * Day of week (0=Sun) for a date key. A calendar date's weekday
 * is the same worldwide — anchor at UTC noon to avoid any
 * server-timezone/DST influence.
 */
export function dayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/** Add N days to a date key. */
export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return kolkataDateKey(d);
}

/** Absolute (UTC) instant for a clinic date+time — used for Google Calendar events. */
export function toUtcInstant(dateKey: string, timeHHMM: string): Date {
  return new Date(`${dateKey}T${timeHHMM}:00+05:30`);
}

/** Human duration like "1h 30m". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
