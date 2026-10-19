/**
 * Synchronization recovery worker.
 *
 * If Google Calendar succeeds but the Sheets write fails (or vice
 * versa), the booking stays valid in the primary backend and the
 * failed operation is queued here for retry — never duplicated.
 * The admin dashboard shows the pending items until reconciled.
 */
import { getDb } from "./db";
import { getAppointment } from "./booking";
import { calendarProvider, type CalendarProvider } from "./google/calendar";
import { sheetsSync, type SheetsSync } from "./google/sheets";
import { auditLog } from "./audit";

export interface SyncTask {
  id: number;
  appointment_id: string;
  operation: "create" | "update" | "cancel" | "delete";
  target: "calendar" | "sheets";
  attempts: number;
  last_error: string | null;
}

export function pendingSyncTasks(): SyncTask[] {
  return getDb()
    .prepare("SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id")
    .all() as unknown as SyncTask[];
}

export async function processSyncQueue(
  providers: { calendar?: CalendarProvider; sheets?: SheetsSync } = {}
): Promise<{ processed: number; failed: number }> {
  const tasks = pendingSyncTasks();
  let failed = 0;
  for (const task of tasks) {
    const apt = getAppointment(task.appointment_id);
    if (!apt) {
      getDb().prepare("UPDATE sync_queue SET status = 'dead', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), task.id);
      continue;
    }
    try {
      if (task.target === "calendar") {
        const cal = providers.calendar ?? calendarProvider();
        if (!cal) throw new Error("Google Calendar not configured");
        if (task.operation === "create" || task.operation === "update") {
          if (!apt.calendar_event_id) {
            const eventId = await cal.createEvent(apt);
            getDb().prepare("UPDATE appointments SET calendar_event_id = ?, calendar_sync_status = 'synced', updated_at = ? WHERE id = ?")
              .run(eventId, new Date().toISOString(), apt.id);
          } else {
            await cal.updateEvent(apt);
            getDb().prepare("UPDATE appointments SET calendar_sync_status = 'synced', updated_at = ? WHERE id = ?")
              .run(new Date().toISOString(), apt.id);
          }
        } else {
          await cal.cancelEvent(apt);
          getDb().prepare("UPDATE appointments SET calendar_sync_status = 'synced', updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), apt.id);
        }
      } else {
        const sheets = providers.sheets ?? sheetsSync();
        if (!sheets) throw new Error("Google Sheets not configured");
        if (task.operation === "create") await sheets.recordAppointment(apt);
        else if (task.operation === "update") await sheets.recordAppointment(apt);
        else await sheets.recordCancellation(apt);
        getDb().prepare("UPDATE appointments SET sheets_sync_status = 'synced', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), apt.id);
      }
      getDb().prepare("UPDATE sync_queue SET status = 'done', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), task.id);
      auditLog("sync-worker", "sync.completed", task.target, apt.id, `operation=${task.operation}`);
    } catch (e) {
      failed++;
      const attempts = task.attempts + 1;
      const status = attempts >= 5 ? "dead" : "pending";
      getDb()
        .prepare("UPDATE sync_queue SET attempts = ?, last_error = ?, status = ?, updated_at = ? WHERE id = ?")
        .run(attempts, (e as Error).message, status, new Date().toISOString(), task.id);
      if (status === "dead") {
        auditLog("sync-worker", "sync.exhausted", task.target, task.appointment_id, (e as Error).message);
      }
    }
  }
  return { processed: tasks.length, failed };
}

/** Reconciliation: find confirmed appointments whose Sheets row is missing/stale. */
export function reconciliationIssues(): Array<{ appointment_id: string; issue: string }> {
  const rows = getDb()
    .prepare(
      `SELECT id, calendar_sync_status, sheets_sync_status FROM appointments
       WHERE status = 'confirmed' AND (sheets_sync_status != 'synced' OR calendar_sync_status = 'failed')`
    )
    .all() as Array<{ id: string; calendar_sync_status: string; sheets_sync_status: string }>;
  return rows.map((r) => ({
    appointment_id: r.id,
    issue: r.sheets_sync_status !== "synced" ? `Sheets sync: ${r.sheets_sync_status}` : `Calendar sync: ${r.calendar_sync_status}`,
  }));
}
