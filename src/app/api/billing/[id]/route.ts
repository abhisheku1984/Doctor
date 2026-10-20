import { NextRequest, NextResponse } from "next/server";
import { getBilling, updateBillingStatus } from "@/lib/billing";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const billing = getBilling(params.id);
  if (!billing) return NextResponse.json({ error: "Billing record not found." }, { status: 404 });

  // Patients can only view own invoices
  if (role === "patient" && billing.patient_id !== ctx.user?.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  // Hospital owner isolation
  if (role === "hospital_owner" && billing.hospital_id !== ctx.user?.hospital_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return NextResponse.json({ billing });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner", "staff"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const billing = getBilling(params.id);
  if (!billing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (role === "hospital_owner" && billing.hospital_id !== ctx.user?.hospital_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updated = updateBillingStatus(params.id, body.status, {
      paid_amount: body.paid_amount,
      payment_method: body.payment_method,
      payment_reference: body.payment_reference,
      actor: ctx.user?.email ?? "admin",
    });
    return NextResponse.json({ ok: true, billing: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
