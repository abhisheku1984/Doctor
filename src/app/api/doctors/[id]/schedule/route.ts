import { NextRequest, NextResponse } from "next/server";
import { getDoctor, getDoctorSchedules, upsertDoctorSchedule } from "@/lib/hospitals";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const doctor = getDoctor(params.id);
  if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  const schedules = getDoctorSchedules(params.id);
  return NextResponse.json({ doctor, schedules });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const doctor = getDoctor(params.id);
  if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });

  if (role === "hospital_owner" && ctx.user?.hospital_id !== doctor.hospital_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const schedules = body.schedules as Array<{
      day_of_week: number; open_time: string | null; close_time: string | null;
      break_start: string | null; break_end: string | null;
      slot_duration_min?: number; buffer_min?: number; max_bookings_per_slot?: number; active?: boolean;
    }>;

    if (!schedules?.length) return NextResponse.json({ error: "No schedules provided." }, { status: 400 });

    for (const s of schedules) {
      upsertDoctorSchedule(params.id, s);
    }

    return NextResponse.json({ ok: true, schedules: getDoctorSchedules(params.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
