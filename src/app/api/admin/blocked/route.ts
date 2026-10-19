import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { addBlockedPeriod, getBlockedPeriods, removeBlockedPeriod } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { todayKey, addDays } from "@/lib/time";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const from = req.nextUrl.searchParams.get("from") ?? todayKey();
  const to = req.nextUrl.searchParams.get("to") ?? addDays(todayKey(), 90);
  return NextResponse.json({ ok: true, periods: getBlockedPeriods(from, to) });
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  reason: z.string().min(1).max(200),
  kind: z.enum(["holiday", "leave", "blocked"]),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid blocked period." }, { status: 400 });
  const actor = (await (await import("@/lib/auth")).readSession(req))!.admin!.username;
  addBlockedPeriod({
    date: parsed.data.date,
    start_time: parsed.data.start_time ?? null,
    end_time: parsed.data.end_time ?? null,
    reason: parsed.data.reason,
    kind: parsed.data.kind,
    updated_by: actor,
  });
  auditLog(actor, "schedule.blocked", "blocked_period", parsed.data.date, parsed.data.reason);
  return NextResponse.json({ ok: true, periods: getBlockedPeriods(todayKey(), addDays(todayKey(), 90)) });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const actor = (await (await import("@/lib/auth")).readSession(req))!.admin!.username;
  removeBlockedPeriod(id);
  auditLog(actor, "schedule.unblocked", "blocked_period", String(id));
  return NextResponse.json({ ok: true });
}
