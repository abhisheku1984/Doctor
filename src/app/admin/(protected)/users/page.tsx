"use client";
import { useEffect, useState } from "react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "hospital_owner", password: "", mobile: "" });
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(), 400); return () => clearTimeout(t); }, [search]);

  const create = async () => {
    setError(null);
    if (!form.email || !form.name || !form.password) { setError("Email, name, and password required."); return; }
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setShowForm(false); setForm({ email: "", name: "", role: "hospital_owner", password: "", mobile: "" }); load();
  };

  const toggleStatus = async (u: any) => {
    const s = u.status === "active" ? "suspended" : "active";
    await fetch(`/api/admin/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Deactivate this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy-900">User Management</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          {showForm ? "Cancel" : "+ Create User"}
        </button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, mobile…" className="w-full max-w-md rounded-xl border border-navy-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500" />

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <h3 className="font-semibold text-navy-900">Create User</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Email *<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">Name *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Name" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm">
                <option value="hospital_owner">Hospital Owner</option>
                <option value="staff">Staff</option>
                <option value="doctor">Doctor</option>
                <option value="patient">Patient</option>
              </select>
            </label>
            <label className="text-sm">Password *<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 chars" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm">Mobile<input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="9876543210" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" /></label>
          </div>
          <button onClick={create} className="mt-4 rounded-xl bg-navy-900 px-6 py-2.5 text-sm font-semibold text-white">Create</button>
        </div>
      )}

      {loading ? <p className="text-sm text-navy-400">Loading…</p> : (
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-navy-50 text-left text-xs uppercase text-navy-500">
              <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Hospital</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-navy-50">
                  <td className="px-4 py-3"><span className="font-medium text-navy-900">{u.name}</span><br /><span className="text-xs text-navy-400">{u.email} {u.mobile ? `· ${u.mobile}` : ""}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 capitalize">{u.role.replace("_", " ")}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${u.status === "active" ? "bg-green-50 text-green-700" : u.status === "suspended" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{u.status}</span></td>
                  <td className="px-4 py-3 text-xs text-navy-400">{u.hospital_id ?? "—"}</td>
                  <td className="px-4 py-3 flex gap-1 flex-wrap">
                    <button onClick={() => toggleStatus(u)} className="rounded bg-navy-50 px-2 py-1 text-xs hover:bg-navy-100">{u.status === "active" ? "Suspend" : "Activate"}</button>
                    <button onClick={() => remove(u.id)} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Deactivate</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-navy-400">No users.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
