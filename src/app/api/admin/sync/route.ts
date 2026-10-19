import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { processSyncQueue, pendingSyncTasks, reconciliationIssues } from "@/lib/sync";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Retry all pending sync operations (Calendar / Sheets recovery). */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const actor = (await (await import("@/lib/auth")).readSession(req))!.admin!.username;
  auditLog(actor, "sync.retry", "sync_queue");
  const result = await processSyncQueue();
  return NextResponse.json({ ok: true, ...result, pending: pendingSyncTasks().length, issues: reconciliationIssues() });
}

/** Queue + reconciliation status. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const pending = pendingSyncTasks();
  const d = (await import("@/lib/db")).getDb();
  const failed = d
    .prepare(
      `SELECT id, date, time, patient_name, sheets_sync_status, calendar_sync_status FROM appointments
       WHERE sheets_sync_status = 'failed' OR calendar_sync_status = 'failed'`
    )
    .all();
  return NextResponse.json({
    ok: true,
    pending,
    failedAppointments: failed,
    issues: reconciliationIssues(),
  });
}
