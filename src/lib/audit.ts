/** Append-only audit trail for administrative and booking actions. */
import { getDb } from "./db";

export function auditLog(actor: string, action: string, entity?: string, entityId?: string | null, details?: string | null): void {
  try {
    getDb()
      .prepare("INSERT INTO audit_log (actor, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(actor, action, entity ?? null, entityId ?? null, details ? JSON.stringify(details).slice(0, 2000) : null, new Date().toISOString());
  } catch {
    // Audit failure must never break the primary workflow.
  }
}

export function recentAuditLogs(limit = 50) {
  return getDb().prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit);
}
