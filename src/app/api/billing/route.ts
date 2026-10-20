import { NextRequest, NextResponse } from "next/server";
import { listBilling, createBilling, getBillingStats } from "@/lib/billing";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Stats view
  if (searchParams.get("view") === "stats") {
    const hospital_id = role === "hospital_owner" ? ctx.user?.hospital_id ?? undefined : (searchParams.get("hospital_id") || undefined);
    const stats = getBillingStats(hospital_id);
    return NextResponse.json({ stats });
  }

  // Patient can only see own invoices
  if (role === "patient") {
    const records = listBilling({ patient_id: ctx.user?.id, limit: 50 });
    return NextResponse.json({ billing: records });
  }

  const hospital_id = role === "hospital_owner" ? ctx.user?.hospital_id ?? undefined : (searchParams.get("hospital_id") || undefined);
  const patient_id = searchParams.get("patient_id") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

  const records = listBilling({ hospital_id, patient_id, status, search, limit, offset });
  return NextResponse.json({ billing: records });
}

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner", "staff"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized. Only staff can create invoices." }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.patient_name || !body.patient_mobile || !body.items?.length) {
      return NextResponse.json({ error: "Missing required fields: patient_name, patient_mobile, items" }, { status: 400 });
    }

    let hospital_id = body.hospital_id;
    if (role === "hospital_owner") hospital_id = ctx.user?.hospital_id ?? hospital_id;
    if (!hospital_id) hospital_id = "hosp_default";

    const billing = createBilling({
      appointment_id: body.appointment_id ?? null,
      hospital_id,
      patient_id: body.patient_id ?? null,
      patient_name: body.patient_name,
      patient_mobile: body.patient_mobile,
      patient_email: body.patient_email,
      items: body.items,
      tax_rate: body.tax_rate,
      discount_amount: body.discount_amount,
      due_date: body.due_date,
      created_by: ctx.user?.id ?? ctx.session?.admin?.username ?? "admin",
    }, ctx.user?.email ?? "admin");

    return NextResponse.json({ ok: true, billing }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
