import { NextRequest, NextResponse } from "next/server";
import { listDepartments, createDepartment } from "@/lib/hospitals";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);
  const hospital_id = searchParams.get("hospital_id") || "hosp_default";
  const departments = listDepartments(hospital_id);
  return NextResponse.json({ departments });
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
    if (!body.name) return NextResponse.json({ error: "Department name is required." }, { status: 400 });

    let hospital_id = body.hospital_id || "hosp_default";
    if (role === "hospital_owner") hospital_id = ctx.user?.hospital_id ?? hospital_id;

    const dept = createDepartment({
      hospital_id,
      name: body.name,
      description: body.description,
      icon: body.icon,
    }, ctx.user?.email ?? "admin");

    return NextResponse.json({ ok: true, department: dept }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
