"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui";

interface DashboardData {
  today: { date: string; label: string; count: number; appointments: Array<{ id: string; time: string; patient_name: string; mode: string; status: string }> };
  upcoming: Array<{ id: string; date: string; time: string; patient_name: string; mode: string }>;
  statusCounts: Record<string, number>;
  modeCounts: { in_person: number; online: number };
  integrations: Record<string, string>;
  syncIssues: Array<{ appointment_id: string; issue: string }>;
  launchChecklist: Array<{ key: string; label: string; done: boolean; hint: string }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unauthorized"))))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return <p className="text-navy-500">Loading dashboard…</p>;

  const liveCalendar = data.integrations.calendar === "live";
  const liveSheets = data.integrations.sheets === "live";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-navy-900">Dashboard</h1>
        <div className="flex gap-2">
          <Badge tone={liveCalendar ? "green" : "amber"}>Calendar: {liveCalendar ? "Live" : "Demo"}</Badge>
          <Badge tone={liveSheets ? "green" : "amber"}>Sheets: {liveSheets ? "Live" : "Demo"}</Badge>
        </div>
      </div>

      {/* Today */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-500">
          Today — {data.today.label}
        </h2>
        {data.today.appointments.length === 0 ? (
          <Card className="p-8 text-center text-sm text-navy-500">No appointments today.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.today.appointments.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-semibold text-navy-900">{a.time}</span>
                  <Badge tone={a.mode === "online" ? "teal" : "navy"}>{a.mode === "online" ? "Online" : "In-person"}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-navy-800">{a.patient_name}</p>
                <p className="text-xs text-navy-400">{a.id} · {a.status}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Confirmed" value={data.statusCounts.confirmed ?? 0} />
        <Stat label="Cancelled" value={data.statusCounts.cancelled ?? 0} />
        <Stat label="Completed" value={data.statusCounts.completed ?? 0} />
        <Stat label="No-shows" value={data.statusCounts.no_show ?? 0} />
        <Stat label="In-person (total)" value={data.modeCounts.in_person} />
        <Stat label="Online (total)" value={data.modeCounts.online} />
        <Stat label="Upcoming" value={data.upcoming.length} />
        <Stat label="Sync issues" value={data.syncIssues.length} tone={data.syncIssues.length ? "amber" : "green"} />
      </section>

      {/* Sync alerts */}
      {data.syncIssues.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">Sync reconciliation needed</h2>
          <ul className="mt-3 space-y-1 text-sm text-amber-900">
            {data.syncIssues.map((i) => (
              <li key={i.appointment_id}>• {i.appointment_id}: {i.issue}</li>
            ))}
          </ul>
          <Link href="/admin/integrations" className="mt-3 inline-block text-sm font-semibold text-amber-900 underline">
            Open Integrations to retry sync →
          </Link>
        </section>
      )}

      {/* Upcoming */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-500">Upcoming appointments</h2>
        <Card className="divide-y divide-navy-100">
          {data.upcoming.length === 0 && <p className="p-6 text-sm text-navy-500">Nothing scheduled.</p>}
          {data.upcoming.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-navy-900">{a.patient_name}</p>
                <p className="text-xs text-navy-500">{a.date} · {a.time} · {a.id}</p>
              </div>
              <Badge tone={a.mode === "online" ? "teal" : "navy"}>{a.mode === "online" ? "Online" : "In-person"}</Badge>
            </div>
          ))}
        </Card>
      </section>

      {/* Launch checklist */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-500">Launch readiness</h2>
        <Card className="divide-y divide-navy-100">
          {data.launchChecklist.map((item) => (
            <div key={item.key} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${item.done ? "bg-emerald-500" : "bg-amber-400"}`} aria-hidden="true" />
              <span className="font-medium text-navy-800">{item.label}</span>
              <span className="ml-auto text-xs text-navy-400">{item.done ? "Done" : "Action needed"}</span>
            </div>
          ))}
        </Card>
        <p className="mt-3 text-xs text-navy-500">
          Complete items in <Link href="/admin/integrations" className="text-teal-700 underline">Integrations</Link> and edit <code className="rounded bg-navy-100 px-1">config/clinic.json</code> to finish setup.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "green" }) {
  return (
    <Card className="p-5">
      <p className={`font-display text-3xl font-semibold ${tone === "amber" ? "text-amber-600" : "text-navy-900"}`}>{value}</p>
      <p className="mt-1 text-sm text-navy-500">{label}</p>
    </Card>
  );
}
