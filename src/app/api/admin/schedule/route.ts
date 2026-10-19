import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getScheduleRules, upsertScheduleRule } from "@/lib/db";
import { getDayAvailability } from "@/lib/booking";
import { addDays, todayKey } from "@/lib/time";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ruleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  close_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  break_start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  break_end: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  duration_min: z.number().int().min(5).max(120),
  buffer_min: z.number().int().min(0).max(60),
  active: z.boolean(),
});

/** GET current schedule + availability preview. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const previewDate = req.nextUrl.searchParams.get("previewDate") ?? todayKey();
  const mode = req.nextUrl.searchParams.get("mode") === "online" ? "online" : "in_person";
  const preview = await getDayAvailability(previewDate, mode);
  return NextResponse.json({ ok: true, rules: getScheduleRules(), preview });
}

/** PUT update the weekly schedule. */
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const body = await req.json();
  const parsed = z.array(ruleSchema).safeParse(body.rules);
  if (!parsed.success) return NextResponse.json({ error: "Invalid schedule data." }, { status: 400 });

  // Validate: open < close, break within hours.
  for (const r of parsed.data) {
    if (r.open_time && r.close_time && r.open_time >= r.close_time) {
      return NextResponse.json({ error: `Opening time must be before closing time (day ${r.day_of_week}).` }, { status: 400 });
    }
  }

  const actor = (await (await import("@/lib/auth")).readSession(req))!.admin!.username;
  const { transaction } = await import("@/lib/db");
  transaction(() => {
    for (const r of parsed.data) upsertScheduleRule(r);
  });
  auditLog(actor, "schedule.updated", "schedule", null, JSON.stringify(parsed.data).slice(0, 500));
  return NextResponse.json({ ok: true, rules: getScheduleRules() });
}

/** Preview availability for the next 14 days after a change. */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === "string" ? body.date : todayKey();
  const mode = body.mode === "online" ? "online" : "in_person";
  const preview = await getDayAvailability(date, mode);
  return NextResponse.json({ ok: true, preview });
}
