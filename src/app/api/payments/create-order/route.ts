import { NextRequest, NextResponse } from "next/server";
import { createRazorpayOrder, isRazorpayConfigured, getBilling } from "@/lib/billing";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  if (!ctx.session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!isRazorpayConfigured()) {
    return NextResponse.json({
      error: "Payment gateway is not configured.",
      hint: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. Contact administrator.",
      configured: false,
    }, { status: 503 });
  }

  try {
    const body = await req.json();
    const billing_id = body.billing_id;
    if (!billing_id) return NextResponse.json({ error: "billing_id is required." }, { status: 400 });

    const billing = getBilling(billing_id);
    if (!billing) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    // Patients can only pay their own invoices
    const role = ctx.user?.role ?? "patient";
    if (role === "patient" && billing.patient_id !== ctx.user?.id) {
      // Also allow by appointment ownership check — fallback
      if (billing.patient_mobile !== ctx.user?.mobile) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    }

    const amount = billing.total_amount - billing.paid_amount;
    if (amount <= 0) return NextResponse.json({ error: "Invoice already paid." }, { status: 400 });

    const result = await createRazorpayOrder({
      billing_id,
      amount,
      currency: "INR",
      receipt: billing.invoice_number,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({
      ok: true,
      order: result.order,
      key_id: process.env.RAZORPAY_KEY_ID,
      billing,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
