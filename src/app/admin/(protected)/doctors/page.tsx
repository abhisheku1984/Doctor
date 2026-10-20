"use client";
import { useEffect, useState } from "react";

interface Doctor {
  id: string; name: string; title: string | null; speciality: string;
  consultation_fee: number | null; status: string; hospital_id: string;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", speciality: "", title: "", consultation_fee: "", department_id: "" });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/doctors?status=all&limit=100");
    const data = await res.json();
    setDoctors(data.doctors ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError(null);
    if (!form.name || !form.speciality) { setError("Name and speciality required."); return; }
    const res = await fetch("/api/doctors", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, speciality: form.speciality, title: form.title || null,
        consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : null,
      }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setForm({ name: "", speciality: "", title: "", consultation_fee: "", department_id: "" });
    setShowForm(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this doctor?")) return;
    await fetch(`/api/doctors/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Doctors</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          {showForm ? "Cancel" : "+ Add Doctor"}
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <h3 className="font-semibold text-navy-900">Add Doctor</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Name *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. John Doe" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
            <label className="text-sm">Speciality *<input value={form.speciality} onChange={(e) => setForm({ ...form, speciality: e.target.value })} placeholder="Cardiology" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
            <label className="text-sm">Title / Qualifications<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="MBBS, MD" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
            <label className="text-sm">Consultation Fee (₹)<input type="number" value={form.consultation_fee} onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })} placeholder="500" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
          </div>
          <button onClick={create} className="mt-4 rounded-xl bg-navy-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">Create Doctor</button>
        </div>
      )}

      {loading ? <p className="text-sm text-navy-400">Loading…</p> : (
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-navy-100 bg-navy-50 text-left text-xs uppercase tracking-wider text-navy-500">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Speciality</th><th className="px-4 py-3">Fee</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className="border-b border-navy-50">
                  <td className="px-4 py-3 font-medium text-navy-900">{d.name}{d.title ? <span className="text-navy-400 text-xs ml-1">{d.title}</span> : ""}</td>
                  <td className="px-4 py-3 text-navy-600">{d.speciality}</td>
                  <td className="px-4 py-3">{d.consultation_fee ? `₹${d.consultation_fee}` : "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${d.status === "active" ? "bg-green-50 text-green-700" : "bg-navy-50 text-navy-500"}`}>{d.status}</span></td>
                  <td className="px-4 py-3"><button onClick={() => remove(d.id)} className="text-xs text-red-600 hover:underline">Delete</button></td>
                </tr>
              ))}
              {doctors.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-navy-400">No doctors yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
