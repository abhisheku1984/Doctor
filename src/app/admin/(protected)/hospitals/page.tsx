"use client";
import { useEffect, useState } from "react";

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", state: "", address: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/hospitals");
    const data = await res.json();
    setHospitals(data.hospitals ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError(null);
    if (!form.name) { setError("Name required."); return; }
    const res = await fetch("/api/hospitals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setShowForm(false); setForm({ name: "", city: "", state: "", address: "", phone: "", email: "" }); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Hospitals</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          {showForm ? "Cancel" : "+ Add Hospital"}
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <h3 className="font-semibold text-navy-900">Add Hospital</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Name *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">State<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm sm:col-span-2">Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
          </div>
          <button onClick={create} className="mt-4 rounded-xl bg-navy-900 px-6 py-2.5 text-sm font-semibold text-white">Create Hospital</button>
        </div>
      )}

      {loading ? <p className="text-sm text-navy-400">Loading…</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hospitals.map((h) => (
            <div key={h.id} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
              <h3 className="font-semibold text-navy-900">{h.name}</h3>
              <p className="text-xs text-navy-500">{h.city ? `${h.address ?? ""} ${h.city}, ${h.state ?? ""}` : h.address ?? "— No address —"}</p>
              <p className="text-xs text-navy-400 mt-1">{h.phone ?? ""} {h.email ?? ""}</p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${h.status === "active" ? "bg-green-50 text-green-700" : "bg-navy-50 text-navy-500"}`}>{h.status}</span>
            </div>
          ))}
          {hospitals.length === 0 && <p className="col-span-full text-center text-sm text-navy-400 py-8">No hospitals.</p>}
        </div>
      )}
    </div>
  );
}
