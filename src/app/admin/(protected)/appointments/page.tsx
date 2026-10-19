"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Button, Input, Select } from "@/components/ui";

interface Appointment {
  id: string;
  patient_name: string;
  patient_mobile: string;
  patient_email: string | null;
  mode: string;
  service_name: string;
  date: string;
  time: string;
  duration_min: number;
  status: string;
  calendar_sync_status: string;
  sheets_sync_status: string;
  notification_status: string;
  calendar_event_id: string | null;
  online_link: string | null;
  notes: string | null;
  created_at: string;
}

export default function AdminAppointments() {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (mode) p.set("mode", mode);
    if (date) p.set("date", date);
    const res = await fetch(`/api/admin/appointments?${p}`);
    if (res.ok) setRows((await res.json()).appointments);
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/admin/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setMsg(`Updated ${id} → ${status}`);
      void load();
    } else {
      setMsg("Update failed.");
    }
  }

  async function setLink(id: string) {
    const link = window.prompt("Paste the secure consultation link for this appointment:");
    if (!link) return;
    const res = await fetch("/api/admin/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, onlineLink: link }),
    });
    if (res.ok) { setMsg(`Link stored for ${id}`); void load(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-navy-900">Appointments</h1>
        <Button variant="secondary" onClick={() => window.open("/api/admin/appointments", "_self")}>Export CSV</Button>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-40">
          <label className="mb-1 block text-xs font-semibold text-navy-500">Search</label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref / name / mobile" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No-show</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">Mode</label>
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">All</option>
            <option value="in_person">In-person</option>
            <option value="online">Online</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button onClick={() => void load()}>Apply</Button>
      </Card>

      {msg && <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800" role="status">{msg}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wider text-navy-500">
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Date / Time</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sync</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-mono text-xs">{a.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-navy-900">{a.patient_name}</p>
                  <p className="text-xs text-navy-400">+91 {a.patient_mobile}{a.patient_email ? ` · ${a.patient_email}` : ""}</p>
                </td>
                <td className="px-4 py-3">{a.date}<br /><span className="text-navy-500">{a.time}</span></td>
                <td className="px-4 py-3"><Badge tone={a.mode === "online" ? "teal" : "navy"}>{a.mode === "online" ? "Online" : "In-person"}</Badge></td>
                <td className="px-4 py-3 capitalize">{a.status}</td>
                <td className="px-4 py-3">
                  <p className="text-xs"><span className="text-navy-400">Cal:</span> {syncBadge(a.calendar_sync_status)}</p>
                  <p className="text-xs"><span className="text-navy-400">Sheets:</span> {syncBadge(a.sheets_sync_status)}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => void updateStatus(a.id, "completed")}>Complete</Button>
                    <Button variant="ghost" onClick={() => void updateStatus(a.id, "no_show")}>No-show</Button>
                    {a.mode === "online" && <Button variant="ghost" onClick={() => void setLink(a.id)}>Set link</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-sm text-navy-500">No appointments match the filters.</p>}
      </Card>
    </div>
  );
}

function syncBadge(status: string) {
  const tones: Record<string, string> = {
    synced: "text-emerald-600",
    failed: "font-bold text-red-600",
    pending: "text-amber-600",
    not_configured: "text-navy-400",
  };
  return <span className={tones[status] ?? "text-navy-600"}>{status}</span>;
}
