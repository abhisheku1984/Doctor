import { NextRequest, NextResponse } from "next/server";
import { getDoctor, updateDoctor, deleteDoctor, getDoctorSchedules } from "@/lib/hospitals";
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const doctor = getDoctor(params.id);
  if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });

  // Hospital owner isolation
  if (role === "hospital_owner" && ctx.user?.hospital_id !== doctor.hospital_id) {
    return NextResponse.json({ error: "Forbidden. Not your hospital." }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (body.qualifications && Array.isArray(body.qualifications)) {
      body.qualifications = JSON.stringify(body.qualifications);
    }
    if (body.modes && Array.isArray(body.modes)) {
      body.modes = JSON.stringify(body.modes);
    }
    const updated = updateDoctor(params.id, body, ctx.user?.email ?? "admin");
    return NextResponse.json({ ok: true, doctor: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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

  deleteDoctor(params.id, ctx.user?.email ?? "admin");
  return NextResponse.json({ ok: true });
}
