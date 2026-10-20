import { NextRequest, NextResponse } from "next/server";
import { listDoctors, createDoctor } from "@/lib/hospitals";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);
  const hospital_id = searchParams.get("hospital_id") || undefined;
  const department_id = searchParams.get("department_id") || undefined;
  const speciality = searchParams.get("speciality") || undefined;
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || "active";
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));

  const doctors = listDoctors({ hospital_id, department_id, speciality, search, status: status === "all" ? undefined : status, limit });
  return NextResponse.json({ doctors });
}

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.name || !body.speciality) {
      return NextResponse.json({ error: "Name and speciality are required." }, { status: 400 });
    }

    // Hospital owner can only create for their hospital
    let hospital_id = body.hospital_id;
    if (role === "hospital_owner") {
      hospital_id = ctx.user?.hospital_id;
      if (!hospital_id) return NextResponse.json({ error: "No hospital assigned." }, { status: 400 });
    }
    if (!hospital_id) hospital_id = "hosp_default";

    const doctor = createDoctor({
      hospital_id,
      department_id: body.department_id ?? null,
      name: body.name,
      title: body.title ?? null,
      speciality: body.speciality,
      qualifications: body.qualifications ? JSON.stringify(body.qualifications) : null,
      registration_council: body.registration_council ?? null,
      registration_number: body.registration_number ?? null,
      experience_years: body.experience_years ?? null,
      about: body.about ?? null,
      photo_url: body.photo_url ?? null,
      consultation_fee: body.consultation_fee ?? null,
      online_fee: body.online_fee ?? null,
      slot_duration_min: body.slot_duration_min ?? 20,
      slot_buffer_min: body.slot_buffer_min ?? 10,
      max_bookings_per_slot: body.max_bookings_per_slot ?? 1,
      modes: body.modes ? JSON.stringify(body.modes) : undefined,
      status: body.status ?? "active",
    }, ctx.user?.email ?? ctx.session?.admin?.username ?? "admin");

    return NextResponse.json({ ok: true, doctor }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
