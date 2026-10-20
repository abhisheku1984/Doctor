import { NextRequest, NextResponse } from "next/server";
import { getHospital, updateHospital } from "@/lib/hospitals";
import { getAuthContext, getActorLabel } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const hospital = getHospital(params.id);
  if (!hospital) return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  return NextResponse.json({ hospital });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  // Patients cannot modify hospitals
  if (role === "patient") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const hospital = getHospital(params.id);
  if (!hospital) return NextResponse.json({ error: "Hospital not found." }, { status: 404 });

  // Hospital owner can only update their own
  if (role === "hospital_owner" && ctx.user?.hospital_id !== params.id) {
    return NextResponse.json({ error: "Forbidden. Not your hospital." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updated = updateHospital(params.id, body, getActorLabel(ctx));
    return NextResponse.json({ ok: true, hospital: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
