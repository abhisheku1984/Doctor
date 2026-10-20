import { NextRequest, NextResponse } from "next/server";
import { listHospitals, createHospital } from "@/lib/hospitals";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const hospitals = listHospitals({ status, search });
  return NextResponse.json({ hospitals });
}

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Only Super Admin can create hospitals." }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "Hospital name is required." }, { status: 400 });
    const hospital = createHospital(body, ctx.user?.email ?? ctx.session?.admin?.username ?? "admin");
    return NextResponse.json({ ok: true, hospital }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
