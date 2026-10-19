import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { listAppointments, setAppointmentStatus, getAppointment, setOnlineLink, type AppointmentStatus } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** List + search + filter appointments (admin). */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const q = req.nextUrl.searchParams;
  const rows = listAppointments({
    date: q.get("date") ?? undefined,
    status: q.get("status") ?? undefined,
    mode: q.get("mode") ?? undefined,
    query: q.get("q") ?? undefined,
    limit: Math.min(Number(q.get("limit") ?? 200), 1000),
  });
  return NextResponse.json({ ok: true, appointments: rows });
}

/** Update appointment status / online link (admin). */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const parsed = z
    .object({
      id: z.string().min(1),
      status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
      onlineLink: z.string().url().optional(),
    })
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const actor = (await (await import("@/lib/auth")).readSession(req))!.admin!.username;
  if (parsed.data.status) {
    setAppointmentStatus(parsed.data.id, parsed.data.status as AppointmentStatus, actor);
  }
  if (parsed.data.onlineLink !== undefined) {
    setOnlineLink(parsed.data.id, parsed.data.onlineLink, actor);
  }
  return NextResponse.json({ ok: true, appointment: getAppointment(parsed.data.id) });
}

/** CSV export of authorized operational data. */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const rows = listAppointments({ limit: 1000 });
  const header = "Appointment ID,Created At,Date,Time,Patient Name,Patient Mobile,Mode,Service,Duration,Status,Calendar Event,Sheets Sync,Last Updated";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((a) =>
    [a.id, a.created_at, a.date, a.time, a.patient_name, a.patient_mobile, a.mode, a.service_name, a.duration_min, a.status, a.calendar_event_id ?? "", a.sheets_sync_status, a.updated_at].map(esc).join(",")
  );
  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=appointments.csv" },
  });
}

/** Recent audit log entries. */
export async function DELETE() {
  return NextResponse.json({ error: "Use GET instead." }, { status: 405 });
}
