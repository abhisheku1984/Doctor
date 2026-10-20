"use client";
import { useEffect, useState } from "react";

export default function AdminAnalyticsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/analytics?view=dashboard");
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
      }
      const res2 = await fetch("/api/analytics?limit=20");
      if (res2.ok) {
        const data2 = await res2.json();
        setEvents(data2.events ?? []);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <p className="text-sm text-navy-400">Loading analytics…</p>;
  if (!dashboard) return <p className="text-sm text-navy-400">No analytics data yet.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Visitor Analytics</h1>
        <a href="/api/analytics?view=export" download className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Export CSV</a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-navy-100 bg-white p-5"><p className="text-xs text-navy-400">Total Events</p><p className="text-2xl font-bold text-navy-900">{dashboard.totalEvents}</p></div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5"><p className="text-xs text-navy-400">Page Views</p><p className="text-2xl font-bold text-navy-900">{dashboard.pageViews}</p></div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5"><p className="text-xs text-navy-400">Booking Completions</p><p className="text-2xl font-bold text-teal-600">{dashboard.bookingCompletes}</p></div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5"><p className="text-xs text-navy-400">Conversion Rate</p><p className="text-2xl font-bold text-navy-900">{dashboard.conversionRate}%</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-navy-100 bg-white p-6">
          <h3 className="font-semibold text-navy-900">Top Pages</h3>
          <div className="mt-4 space-y-2">
            {dashboard.topPages?.length ? dashboard.topPages.map((p: any) => (
              <div key={p.page} className="flex justify-between text-sm">
                <span className="text-navy-600 truncate max-w-[70%]">{p.page}</span>
                <span className="font-medium text-navy-900">{p.count}</span>
              </div>
            )) : <p className="text-sm text-navy-400">No page view data yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white p-6">
          <h3 className="font-semibold text-navy-900">Events by Type</h3>
          <div className="mt-4 space-y-2">
            {dashboard.eventsByType?.map((e: any) => (
              <div key={e.event_type} className="flex justify-between text-sm">
                <span className="text-navy-600">{e.event_type}</span>
                <span className="font-medium text-navy-900">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dashboard.eventsByDevice?.length > 0 && (
        <div className="rounded-2xl border border-navy-100 bg-white p-6">
          <h3 className="font-semibold text-navy-900">Devices</h3>
          <div className="mt-4 flex gap-4">
            {dashboard.eventsByDevice.map((d: any) => (
              <span key={d.device_category} className="rounded-full bg-navy-50 px-3 py-1 text-sm">{d.device_category}: {d.count}</span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-navy-100 bg-white p-6">
        <h3 className="font-semibold text-navy-900">Recent Events</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-navy-50 text-left text-xs uppercase text-navy-500">
              <th className="px-3 py-2">Type</th><th className="px-3 py-2">Page</th><th className="px-3 py-2">Device</th><th className="px-3 py-2">Date</th>
            </tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id} className="border-b border-navy-50">
                  <td className="px-3 py-2">{e.event_type}</td><td className="px-3 py-2 text-xs truncate max-w-[200px]">{e.page ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{e.device_category ?? "—"}</td><td className="px-3 py-2 text-xs text-navy-400">{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-navy-400">No events tracked yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
