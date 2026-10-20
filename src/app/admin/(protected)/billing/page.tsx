"use client";
import { useEffect, useState } from "react";

export default function AdminBillingPage() {
  const [billing, setBilling] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ patient_name: "", patient_mobile: "", item_name: "", item_price: "", tax_rate: "" });

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    const res = await fetch(`/api/billing?${params}`);
    const data = await res.json();
    setBilling(data.billing ?? []);
    const sRes = await fetch("/api/billing?view=stats");
    const sData = await sRes.json();
    setStats(sData.stats);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const create = async () => {
    if (!form.patient_name || !form.patient_mobile || !form.item_name || !form.item_price) return;
    const res = await fetch("/api/billing", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_name: form.patient_name, patient_mobile: form.patient_mobile,
        items: [{ name: form.item_name, quantity: 1, unit_price: Number(form.item_price), amount: Number(form.item_price) }],
        tax_rate: form.tax_rate ? Number(form.tax_rate) : undefined,
      }),
    });
    if (res.ok) { setShowCreate(false); setForm({ patient_name: "", patient_mobile: "", item_name: "", item_price: "", tax_rate: "" }); load(); }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/billing/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Billing & Invoices</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          {showCreate ? "Cancel" : "+ New Invoice"}
        </button>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-navy-100 bg-white p-4"><p className="text-xs text-navy-400">Total Invoices</p><p className="text-xl font-bold text-navy-900">{stats.total ?? 0}</p></div>
          <div className="rounded-2xl border border-navy-100 bg-white p-4"><p className="text-xs text-navy-400">Pending</p><p className="text-xl font-bold text-amber-600">{stats.pending ?? 0}</p></div>
          <div className="rounded-2xl border border-navy-100 bg-white p-4"><p className="text-xs text-navy-400">Paid</p><p className="text-xl font-bold text-green-600">{stats.paid ?? 0}</p></div>
          <div className="rounded-2xl border border-navy-100 bg-white p-4"><p className="text-xs text-navy-400">Total Revenue</p><p className="text-xl font-bold text-navy-900">₹{stats.totalRevenue ?? 0}</p></div>
        </div>
      )}

      {showCreate && (
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <h3 className="font-semibold text-navy-900">Create Invoice</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Patient Name<input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">Patient Mobile<input value={form.patient_mobile} onChange={(e) => setForm({ ...form, patient_mobile: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">Item Name<input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="Consultation" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">Price (₹)<input type="number" value={form.item_price} onChange={(e) => setForm({ ...form, item_price: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
          </div>
          <button onClick={create} className="mt-4 rounded-xl bg-navy-900 px-6 py-2.5 text-sm font-semibold text-white">Create</button>
        </div>
      )}

      <div className="flex gap-2">
        {["all", "pending", "paid", "failed", "refunded"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-4 py-1.5 text-xs font-medium ${filter === s ? "bg-teal-600 text-white" : "bg-navy-50 text-navy-600"}`}>{s}</button>
        ))}
      </div>

      {loading ? <p className="text-sm text-navy-400">Loading…</p> : (
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-navy-50 text-left text-xs uppercase text-navy-500">
              <th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {billing.map((b) => (
                <tr key={b.id} className="border-b border-navy-50">
                  <td className="px-4 py-3 font-mono text-xs">{b.invoice_number}</td>
                  <td className="px-4 py-3">{b.patient_name}<br /><span className="text-xs text-navy-400">{b.patient_mobile}</span></td>
                  <td className="px-4 py-3 font-semibold">₹{b.total_amount}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${b.status === "paid" ? "bg-green-50 text-green-700" : b.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-navy-50 text-navy-500"}`}>{b.status}</span></td>
                  <td className="px-4 py-3 flex gap-1 flex-wrap">
                    {b.status === "pending" && <button onClick={() => updateStatus(b.id, "paid")} className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">Mark Paid</button>}
                    <button onClick={() => updateStatus(b.id, "refunded")} className="rounded bg-navy-50 px-2 py-1 text-xs">Refund</button>
                  </td>
                </tr>
              ))}
              {billing.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-navy-400">No invoices.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
