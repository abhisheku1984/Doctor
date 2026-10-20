import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getAuthContext } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getLaunchChecklist, integrationStatus } from "@/lib/config";
import { reconciliationIssues } from "@/lib/sync";
import { todayKey, displayDate, addDays } from "@/lib/time";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  // Support both legacy admin and new auth
  const ctx = await getAuthContext(req);
  if (!ctx.session) {
    const guard = await requireAdmin(req);
    if (guard) return guard;
  }

  const d = getDb();
  const today = todayKey();
  const todays = d.prepare("SELECT * FROM appointments WHERE date = ? ORDER BY time").all(today) as any[];
  const upcoming = d.prepare("SELECT * FROM appointments WHERE date >= ? AND status = 'confirmed' ORDER BY date, time LIMIT 10").all(today) as any[];
  const statusCounts = d.prepare("SELECT status, COUNT(*) AS c FROM appointments GROUP BY status").all() as Array<{ status: string; c: number }>;
  const modeCounts = d.prepare("SELECT mode, COUNT(*) AS c FROM appointments WHERE status = 'confirmed' GROUP BY mode").all() as Array<{ mode: string; c: number }>;
  const last30 = d.prepare("SELECT date, COUNT(*) AS c FROM appointments WHERE status = 'confirmed' AND date >= ? GROUP BY date ORDER BY date").all(
    addDays(todayKey(), -30)
  ) as Array<{ date: string; c: number }>;

  const counts: Record<string, number> = { confirmed: 0, cancelled: 0, completed: 0, no_show: 0, pending: 0, checked_in: 0, rescheduled: 0 };
  for (const r of statusCounts) counts[r.status] = r.c;

  // Extended stats
  let userStats: Record<string, number> = {};
  let doctorCount = 0;
  let galleryCount = 0;
  let billingStats: Record<string, number> = {};
  let recentUsers: any[] = [];
  let hospitals: any[] = [];

  try {
    const byRole = d.prepare("SELECT role, COUNT(*) as c FROM users GROUP BY role").all() as Array<{ role: string; c: number }>;
    for (const r of byRole) userStats[r.role] = r.c;
    userStats["total"] = Object.values(userStats).reduce((a, b) => a + b, 0);
  } catch { /* tables may not exist yet */ }

  try {
    doctorCount = (d.prepare("SELECT COUNT(*) as c FROM doctors WHERE status='active'").get() as { c: number }).c;
  } catch { /* ignore */ }

  try {
    galleryCount = (d.prepare("SELECT COUNT(*) as c FROM gallery_items WHERE status='published'").get() as { c: number }).c;
  } catch { /* ignore */ }

  try {
    const bCounts = d.prepare("SELECT status, COUNT(*) as c FROM billing_records GROUP BY status").all() as Array<{ status: string; c: number }>;
    for (const r of bCounts) billingStats[r.status] = r.c;
    billingStats["totalRevenue"] = (d.prepare("SELECT COALESCE(SUM(total_amount),0) as s FROM billing_records WHERE status='paid'").get() as { s: number }).s;
  } catch { /* ignore */ }

  try {
    recentUsers = d.prepare("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5").all() as any[];
  } catch { /* ignore */ }

  try {
    hospitals = d.prepare("SELECT * FROM hospitals ORDER BY created_at DESC").all() as any[];
  } catch { /* ignore */ }

  // Drive status
  let driveStatus = "not_configured";
  let driveConfig: any = null;
  try {
    const { isDriveConfigured } = await import("@/lib/google/drive");
    driveStatus = isDriveConfigured() ? "configured" : "not_configured";
    driveConfig = d.prepare("SELECT * FROM drive_config WHERE id='default'").get() as any;
  } catch { /* ignore */ }

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
      drive: driveStatus,
    },
    driveConfig,
    syncIssues: reconciliationIssues(),
    launchChecklist: getLaunchChecklist(),
    bookingsLast30Days: last30,
    userStats,
    doctorCount,
    galleryCount,
    billingStats,
    recentUsers,
    hospitals,
  });
}
