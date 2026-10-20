import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayPayment } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  initDb();
  try {
    const body = await req.json();

    // Razorpay webhook payload structure
    const event = body.event;
    const payment = body.payload?.payment?.entity;
    const order = body.payload?.order?.entity;

    if (!payment && !body.razorpay_order_id) {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }

    // Verify webhook signature if provided
    const signature = req.headers.get("x-razorpay-signature");
    if (signature && process.env.RAZORPAY_WEBHOOK_SECRET) {
      const crypto = await import("crypto");
      const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(JSON.stringify(body)).digest("hex");
      if (expected !== signature) {
        return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
      }
    }

    const orderId = payment?.order_id ?? order?.id ?? body.razorpay_order_id;
    if (!orderId) return NextResponse.json({ error: "No order ID in webhook." }, { status: 400 });

    const now = new Date().toISOString();
    const billing = getDb().prepare("SELECT * FROM billing_records WHERE razorpay_order_id = ?").get(orderId) as any;

    if (!billing) {
      console.warn(`[webhook] No billing found for order ${orderId}`);
      return NextResponse.json({ ok: true, note: "No matching invoice, acknowledged." });
    }

    if (event === "payment.captured" || event === "order.paid" || body.status === "captured") {
      getDb().prepare("UPDATE billing_records SET status = 'paid', paid_amount = total_amount, razorpay_payment_id = ?, paid_at = ?, updated_at = ? WHERE id = ?")
        .run(payment?.id ?? body.razorpay_payment_id ?? "", now, now, billing.id);
    } else if (event === "payment.failed") {
      getDb().prepare("UPDATE billing_records SET status = 'failed', updated_at = ? WHERE id = ?").run(now, billing.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
