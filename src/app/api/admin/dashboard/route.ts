import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getDb } from "@/lib/db";
import { getLaunchChecklist, integrationStatus } from "@/lib/config";
import { reconciliationIssues } from "@/lib/sync";
import { todayKey, displayDate, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const d = getDb();
  const today = todayKey();
  const todays = d.prepare("SELECT * FROM appointments WHERE date = ? ORDER BY time").all(today) as any[];
  const upcoming = d.prepare("SELECT * FROM appointments WHERE date >= ? AND status = 'confirmed' ORDER BY date, time LIMIT 10").all(today) as any[];
  const statusCounts = d.prepare("SELECT status, COUNT(*) AS c FROM appointments GROUP BY status").all() as Array<{ status: string; c: number }>;
  const modeCounts = d.prepare("SELECT mode, COUNT(*) AS c FROM appointments WHERE status = 'confirmed' GROUP BY mode").all() as Array<{ mode: string; c: number }>;
  const last30 = d.prepare("SELECT date, COUNT(*) AS c FROM appointments WHERE status = 'confirmed' AND date >= ? GROUP BY date ORDER BY date").all(
    addDays(todayKey(), -30)
  ) as Array<{ date: string; c: number }>;

  const counts: Record<string, number> = { confirmed: 0, cancelled: 0, completed: 0, no_show: 0 };
  for (const r of statusCounts) counts[r.status] = r.c;

  return NextResponse.json({
    today: { date: today, label: displayDate(today), appointments: todays, count: todays.length },
    upcoming,
    statusCounts: counts,
    modeCounts: {
      in_person: modeCounts.find((m) => m.mode === "in_person")?.c ?? 0,
      online: modeCounts.find((m) => m.mode === "online")?.c ?? 0,
    },
    integrations: {
      calendar: integrationStatus("calendar"),
      sheets: integrationStatus("sheets"),
      email: integrationStatus("email"),
      sms: integrationStatus("sms"),
      avatar: integrationStatus("avatar"),
      onlineConsult: integrationStatus("onlineConsult"),
    },
    syncIssues: reconciliationIssues(),
    launchChecklist: getLaunchChecklist(),
    bookingsLast30Days: last30,
  });
}
