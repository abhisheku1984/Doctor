"use client";
import { useEffect, useState } from "react";

export default function BillingDetailContent({ invoiceId }: { invoiceId: string }) {
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`/api/billing/${invoiceId}`).then(r => r.json()).then(d => {
      if (d.billing) setBilling(d.billing);
      else setError(d.error ?? "Not found.");
    }).catch(() => setError("Failed to load invoice.")).finally(() => setLoading(false));
  }, [invoiceId]);

  const handlePay = async () => {
    setPaying(true); setError(null);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing_id: invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment setup failed.");
      if (!data.order) throw new Error("No order returned.");
      // If Razorpay SDK is available, open checkout; otherwise show demo
      if ((window as any).Razorpay) {
        const options = {
          key: data.key_id, amount: data.order.amount, currency: data.order.currency,
          name: "Hospital Bill Payment", description: `Invoice ${billing.invoice_number}`,
          order_id: data.order.id,
          handler: async (resp: any) => {
            const vRes = await fetch("/api/payments/verify", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature,
              }),
            });
            if (vRes.ok) { window.location.reload(); } else { setError("Payment verification failed."); }
          },
          prefill: { name: billing.patient_name, contact: billing.patient_mobile, email: billing.patient_email ?? "" },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        alert(`Order created: ${data.order.id}\n\nRazorpay SDK not loaded. In production, include checkout.js or use the payment link provided by your gateway.`);
      }
    } catch (e) { setError((e as Error).message); }
    setPaying(false);
  };

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-12 text-center text-navy-500">Loading invoice…</div>;
  if (error && !billing) return <div className="mx-auto max-w-2xl px-4 py-12 text-center text-red-600">{error}</div>;

  const items = (() => { try { return JSON.parse(billing.items); } catch { return []; } })();

  return (
    <div className="bg-navy-50 min-h-[80vh]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-teal-600">Invoice</p>
              <h1 className="font-mono text-xl font-bold text-navy-900">{billing.invoice_number}</h1>
              <p className="text-xs text-navy-400">{new Date(billing.created_at).toLocaleDateString()} · Status: <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${billing.status === "paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{billing.status}</span></p>
            </div>
            <button onClick={() => window.print()} className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs hover:bg-navy-50">Print / Download</button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-navy-400">Patient</p><p className="font-medium text-navy-900">{billing.patient_name}</p><p className="text-navy-500">{billing.patient_mobile} {billing.patient_email ? `· ${billing.patient_email}` : ""}</p></div>
            <div className="text-right"><p className="text-navy-400">Due Date</p><p className="font-medium text-navy-900">{billing.due_date ? new Date(billing.due_date).toLocaleDateString() : "—"}</p></div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-navy-400"><th className="py-2">Item</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={i} className="border-b border-navy-50"><td className="py-2">{it.name} × {it.quantity}</td><td className="py-2 text-right">₹{it.amount}</td></tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-navy-500">Subtotal</span><span>₹{billing.subtotal}</span></div>
            {billing.tax_amount > 0 && <div className="flex justify-between"><span className="text-navy-500">Tax</span><span>₹{billing.tax_amount}</span></div>}
            {billing.discount_amount > 0 && <div className="flex justify-between"><span className="text-navy-500">Discount</span><span>-₹{billing.discount_amount}</span></div>}
            <div className="flex justify-between font-bold text-navy-900 border-t border-navy-100 pt-2 mt-2"><span>Total</span><span>₹{billing.total_amount}</span></div>
            <div className="flex justify-between text-navy-600"><span>Paid</span><span>₹{billing.paid_amount}</span></div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {billing.status === "pending" && (
            <button onClick={handlePay} disabled={paying} className="mt-6 w-full rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {paying ? "Processing…" : `Pay ₹${billing.total_amount - billing.paid_amount} via Razorpay`}
            </button>
          )}
          {billing.status === "paid" && <p className="mt-6 rounded-xl bg-green-50 p-3 text-center text-sm text-green-700">✅ Paid {billing.paid_at ? `on ${new Date(billing.paid_at).toLocaleDateString()}` : ""}</p>}
        </div>
      </div>
    </div>
  );
}
