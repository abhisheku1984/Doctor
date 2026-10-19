/**
 * Google Calendar integration (source of truth for the doctor's
 * working calendar). Returns null when not configured → the whole
 * system then runs in clearly-labeled Demo Mode.
 *
 * PII minimization: event titles contain only the booking reference
 * and consultation mode — no patient name or phone number.
 */
import { google, calendar_v3 } from "googleapis";
import { getGoogleAuth, CALENDAR_SCOPES } from "./auth";
import { integrationStatus } from "../config";
import { toUtcInstant } from "../time";
import type { Appointment } from "../booking";

export interface BusyInterval {
  startMin: number;
  endMin: number;
}

export interface CalendarProvider {
  listBusy(dateKey: string): Promise<BusyInterval[]>;
  createEvent(apt: Appointment): Promise<string>;
  updateEvent(apt: Appointment): Promise<void>;
  cancelEvent(apt: Appointment): Promise<void>;
}

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

function timeBounds(dateKey: string): { start: Date; end: Date } {
  const start = toUtcInstant(dateKey, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function toMinutes(iso: string): number {
  const d = new Date(iso);
  // Convert to Asia/Kolkata wall-clock minutes.
  const kolkata = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return kolkata.getHours() * 60 + kolkata.getMinutes();
}

async function getClient(): Promise<{ calendar: ReturnType<typeof google.calendar>; auth: InstanceType<typeof google.auth.JWT> } | null> {
  const { jwt, configured } = getGoogleAuth(CALENDAR_SCOPES);
  if (!configured || !jwt) return null;
  await jwt.authorize();
  return { calendar: google.calendar({ version: "v3", auth: jwt }), auth: jwt };
}

const liveProvider: CalendarProvider = {
  async listBusy(dateKey: string): Promise<BusyInterval[]> {
    const ctx = await getClient();
    if (!ctx) return [];
    const { start, end } = timeBounds(dateKey);
    const res = await ctx.calendar.events.list({
      calendarId: calendarId(),
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      maxResults: 250,
    });
    return (res.data.items ?? []).map((ev) => ({
      startMin: toMinutes(ev.start?.dateTime ?? ev.start?.date ?? ""),
      endMin: toMinutes(ev.end?.dateTime ?? ev.end?.date ?? ""),
    }));
  },

  async createEvent(apt: Appointment): Promise<string> {
    const ctx = await getClient();
    if (!ctx) throw new Error("Google Calendar is not configured.");
    const start = toUtcInstant(apt.date, apt.time);
    const end = new Date(start.getTime() + apt.duration_min * 60000);
    const res = await ctx.calendar.events.insert({
      calendarId: calendarId(),
      requestBody: {
        summary: `Patient Appointment ${apt.id} (${apt.mode === "online" ? "online" : "in-person"})`,
        description: `Booking reference: ${apt.id}. Mode: ${apt.mode}. Service: ${apt.service_name}. Duration: ${apt.duration_min} min.`,
        start: { dateTime: start.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Kolkata" },
      },
    });
    return res.data.id ?? "";
  },

  async updateEvent(apt: Appointment): Promise<void> {
    const ctx = await getClient();
    if (!ctx) throw new Error("Google Calendar is not configured.");
    if (!apt.calendar_event_id) return;
    const start = toUtcInstant(apt.date, apt.time);
    const end = new Date(start.getTime() + apt.duration_min * 60000);
    await ctx.calendar.events.update({
      calendarId: calendarId(),
      eventId: apt.calendar_event_id,
      requestBody: {
        summary: `Patient Appointment ${apt.id} (${apt.mode === "online" ? "online" : "in-person"})`,
        description: `Booking reference: ${apt.id}. Mode: ${apt.mode}. Service: ${apt.service_name}.`,
        start: { dateTime: start.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Kolkata" },
      },
    });
  },

  async cancelEvent(apt: Appointment): Promise<void> {
    const ctx = await getClient();
    if (!ctx) throw new Error("Google Calendar is not configured.");
    if (!apt.calendar_event_id) return;
    await ctx.calendar.events.delete({ calendarId: calendarId(), eventId: apt.calendar_event_id });
  },
};

/** null when Google credentials are absent → caller must show Demo Mode. */
export function calendarProvider(): CalendarProvider | null {
  if (integrationStatus("calendar") !== "live") return null;
  return liveProvider;
}

/** Admin test helper: verify credentials + list next event. */
export async function testCalendarConnection(): Promise<{ ok: boolean; message: string }> {
  const ctx = await getClient();
  if (!ctx) return { ok: false, message: "Google service-account credentials are not configured." };
  try {
    const res = await ctx.calendar.calendarList.get({ calendarId: calendarId() });
    return { ok: true, message: `Connected — calendar "${res.data.summary}" (${calendarId()}).` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${(e as Error).message}` };
  }
}

export type { calendar_v3 };
