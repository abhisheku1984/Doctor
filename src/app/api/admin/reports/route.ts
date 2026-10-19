import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getDb } from "@/lib/db";
import { addDays, todayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Daily & monthly operational summary (no PII beyond counts). */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const d = getDb();
  const from = addDays(todayKey(), -30);

  const totals = d.prepare(`SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) AS confirmed,
    SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END) AS no_shows,
    SUM(CASE WHEN mode='in_person' THEN 1 ELSE 0 END) AS in_person,
    SUM(CASE WHEN mode='online' THEN 1 ELSE 0 END) AS online
  FROM appointments`).get() as Record<string, number>;

  const daily = d.prepare(`SELECT date, COUNT(*) AS bookings FROM appointments WHERE date >= ? GROUP BY date ORDER BY date`).all(from) as Array<{ date: string; bookings: number }>;
  const monthly = d.prepare(`SELECT substr(date,1,7) AS month, COUNT(*) AS bookings FROM appointments GROUP BY month ORDER BY month`).all() as Array<{ month: string; bookings: number }>;

  return NextResponse.json({ ok: true, totals, daily, monthly });
}
