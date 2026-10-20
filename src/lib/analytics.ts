/**
 * Visitor analytics & activity logs — privacy-conscious tracking.
 * Stores events in SQLite; exports to Google Drive on request.
 */
import crypto from "crypto";
import { getDb } from "./db";

export type AnalyticsEventType =
  | "page_view"
  | "gallery_view"
  | "gallery_interaction"
  | "doctor_profile_view"
  | "doctor_search"
  | "appointment_booking_start"
  | "appointment_booking_complete"
  | "appointment_cancel"
  | "appointment_reschedule"
  | "login_success"
  | "login_failure"
  | "registration"
  | "profile_update"
  | "payment_attempt"
  | "payment_success"
  | "payment_failure"
  | "admin_change"
  | "admin_export"
  | "contact_form"
  | "search";

function genId(): string {
  return `evt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + (process.env.SESSION_PASSWORD ?? "salt")).digest("hex").slice(0, 16);
}

function categorizeDevice(userAgent: string): string {
  if (/mobile|android|iphone/i.test(userAgent)) return "mobile";
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  return "desktop";
}

export interface TrackEventInput {
  event_type: string;
  page?: string | null;
  resource_id?: string | null;
  resource_type?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  hospital_id?: string | null;
  appointment_ref?: string | null;
  outcome?: string | null;
  error_code?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
}

export function trackEvent(input: TrackEventInput): string {
  const event_id = genId();
  const now = new Date().toISOString();
  const device = input.user_agent ? categorizeDevice(input.user_agent) : null;
  const ipHash = input.ip ? hashIp(input.ip) : null;

  getDb().prepare(`
    INSERT INTO analytics_events (event_id, event_type, page, resource_id, resource_type, user_id, session_id, hospital_id, appointment_ref, device_category, browser, os, referrer, outcome, error_code, metadata, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event_id, input.event_type, input.page ?? null, input.resource_id ?? null, input.resource_type ?? null,
    input.user_id ?? null, input.session_id ?? null, input.hospital_id ?? null,
    input.appointment_ref ?? null, device, null, null,
    input.referrer ?? null, input.outcome ?? null, input.error_code ?? null,
    input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : null,
    ipHash, now
  );
  return event_id;
}

export interface AnalyticsFilter {
  event_type?: string;
  page?: string;
  hospital_id?: string;
  user_id?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  limit?: number;
  offset?: number;
}

export function queryEvents(filter: AnalyticsFilter = {}): Array<Record<string, unknown>> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.event_type) { clauses.push("event_type = ?"); params.push(filter.event_type); }
  if (filter.page) { clauses.push("page = ?"); params.push(filter.page); }
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.user_id) { clauses.push("user_id = ?"); params.push(filter.user_id); }
  if (filter.from) { clauses.push("created_at >= ?"); params.push(filter.from); }
  if (filter.to) { clauses.push("created_at <= ?"); params.push(filter.to); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  return getDb().prepare(`SELECT * FROM analytics_events ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params as any[], limit, offset) as unknown as Array<Record<string, unknown>>;
}

export function countEvents(filter: Omit<AnalyticsFilter, "limit" | "offset"> = {}): number {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.event_type) { clauses.push("event_type = ?"); params.push(filter.event_type); }
  if (filter.page) { clauses.push("page = ?"); params.push(filter.page); }
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.from) { clauses.push("created_at >= ?"); params.push(filter.from); }
  if (filter.to) { clauses.push("created_at <= ?"); params.push(filter.to); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (getDb().prepare(`SELECT COUNT(*) as c FROM analytics_events ${where}`).get(...params as any[]) as { c: number }).c;
}

export function getAnalyticsDashboard(hospitalId?: string): {
  totalEvents: number;
  pageViews: number;
  bookingStarts: number;
  bookingCompletes: number;
  conversionRate: number;
  topPages: Array<{ page: string; count: number }>;
  eventsByType: Array<{ event_type: string; count: number }>;
  eventsByDevice: Array<{ device_category: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  recentEvents: Array<Record<string, unknown>>;
} {
  const d = getDb();
  const hospFilter = hospitalId ? "WHERE hospital_id = ?" : "";
  const hospFilterAnd = hospitalId ? "AND hospital_id = ?" : "";
  const hospParams: unknown[] = hospitalId ? [hospitalId] : [];

  const totalEvents = (d.prepare(`SELECT COUNT(*) as c FROM analytics_events ${hospFilter}`).get(...hospParams as any[]) as { c: number }).c;
  const pageViews = (d.prepare(`SELECT COUNT(*) as c FROM analytics_events ${hospFilter ? hospFilter + " AND" : "WHERE"} event_type = 'page_view'`).get(...hospParams as any[]) as { c: number }).c;
  const bookingStarts = (d.prepare(`SELECT COUNT(*) as c FROM analytics_events ${hospFilter ? hospFilter + " AND" : "WHERE"} event_type = 'appointment_booking_start'`).get(...hospParams as any[]) as { c: number }).c;
  const bookingCompletes = (d.prepare(`SELECT COUNT(*) as c FROM analytics_events ${hospFilter ? hospFilter + " AND" : "WHERE"} event_type = 'appointment_booking_complete'`).get(...hospParams as any[]) as { c: number }).c;
  const conversionRate = bookingStarts > 0 ? Math.round(bookingCompletes / bookingStarts * 100) : 0;

  const topPages = d.prepare(`SELECT page, COUNT(*) as count FROM analytics_events ${hospFilter ? hospFilter + " AND" : "WHERE"} event_type = 'page_view' AND page IS NOT NULL GROUP BY page ORDER BY count DESC LIMIT 10`).all(...hospParams as any[]) as unknown as Array<{ page: string; count: number }>;
  const eventsByType = d.prepare(`SELECT event_type, COUNT(*) as count FROM analytics_events ${hospFilter} GROUP BY event_type ORDER BY count DESC LIMIT 20`).all(...hospParams as any[]) as unknown as Array<{ event_type: string; count: number }>;
  const eventsByDevice = d.prepare(`SELECT device_category, COUNT(*) as count FROM analytics_events ${hospFilter ? hospFilter + " AND" : "WHERE"} device_category IS NOT NULL GROUP BY device_category`).all(...hospParams as any[]) as unknown as Array<{ device_category: string; count: number }>;

  // Daily trend last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // Use date() for SQLite date grouping
  let dailyTrend: Array<{ date: string; count: number }> = [];
  try {
    dailyTrend = d.prepare(`SELECT date(created_at) as date, COUNT(*) as count FROM analytics_events WHERE created_at >= ? ${hospFilterAnd} GROUP BY date(created_at) ORDER BY date`).all(thirtyDaysAgo, ...hospParams as any[]) as unknown as Array<{ date: string; count: number }>;
  } catch { /* ignore */ }

  const recentEvents = d.prepare(`SELECT * FROM analytics_events ${hospFilter} ORDER BY created_at DESC LIMIT 20`).all(...hospParams as any[]) as unknown as Array<Record<string, unknown>>;

  return { totalEvents, pageViews, bookingStarts, bookingCompletes, conversionRate, topPages, eventsByType, eventsByDevice, dailyTrend, recentEvents };
}

export function generateCsvExport(filter: AnalyticsFilter = {}): string {
  const events = queryEvents({ ...filter, limit: 10000 });
  if (events.length === 0) return "No data";
  const headers = Object.keys(events[0] as object);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of events) {
    lines.push(headers.map((h) => escape((row as Record<string, unknown>)[h])).join(","));
  }
  return lines.join("\n");
}

/** Verified, consented patients seen on tracked pages (admin only at the API layer). */
export function getIdentifiedVisitors(hospitalId?: string): Array<{
  user_id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  first_seen: string;
  last_seen: string;
  page_views: number;
  last_page: string | null;
}> {
  const db = getDb();
  const hospitalClause = hospitalId ? "AND e.hospital_id = ?" : "";
  const params = hospitalId ? [hospitalId] : [];
  return db.prepare(`
    SELECT e.user_id, u.name,
      CASE WHEN u.email LIKE '%@mobile.local' THEN NULL ELSE u.email END AS email,
      u.mobile, MIN(e.created_at) AS first_seen, MAX(e.created_at) AS last_seen,
      COUNT(*) AS page_views,
      (SELECT latest.page FROM analytics_events latest
       WHERE latest.user_id = e.user_id AND latest.event_type = 'page_view'
       ORDER BY latest.created_at DESC LIMIT 1) AS last_page
    FROM analytics_events e
    JOIN users u ON u.id = e.user_id
    WHERE e.event_type = 'page_view' AND u.role = 'patient'
      AND u.mobile_verified = 1 AND u.consent_given = 1 ${hospitalClause}
    GROUP BY e.user_id, u.name, u.email, u.mobile
    ORDER BY last_seen DESC LIMIT 500
  `).all(...params as any[]) as unknown as Array<{
    user_id: string; name: string; email: string | null; mobile: string | null;
    first_seen: string; last_seen: string; page_views: number; last_page: string | null;
  }>;
}
