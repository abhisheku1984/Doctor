import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayPayment, getBilling } from "@/lib/billing";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  if (!ctx.session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment verification fields." }, { status: 400 });
    }

    // NEVER trust browser redirect alone — verify signature server-side
    const result = verifyRazorpayPayment({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Payment verification failed." }, { status: 400 });
    }

    // Mark billing as paid
    const billing = getDb().prepare("SELECT * FROM billing_records WHERE razorpay_order_id = ?").get(razorpay_order_id) as any;
    if (!billing) return NextResponse.json({ error: "No invoice found for this order." }, { status: 404 });

    const now = new Date().toISOString();
    getDb().prepare("UPDATE billing_records SET status = 'paid', paid_amount = total_amount, razorpay_payment_id = ?, paid_at = ?, updated_at = ? WHERE id = ?")
      .run(razorpay_payment_id, now, now, billing.id);
    getDb().prepare("UPDATE payment_transactions SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'paid', webhook_verified = 1, updated_at = ? WHERE razorpay_order_id = ?")
      .run(razorpay_payment_id, razorpay_signature, now, razorpay_order_id);

    return NextResponse.json({ ok: true, verified: true, billing: getBilling(billing.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
