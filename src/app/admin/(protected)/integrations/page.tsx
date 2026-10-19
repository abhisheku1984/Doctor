"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Button } from "@/components/ui";

interface IntegrationData {
  status: Record<string, string>;
  demoMode: boolean;
  avatar: { provider: string; voice: boolean; lipSync: boolean; animation: boolean; note: string };
  requirements: Record<string, string[]>;
}

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationData | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/integrations")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  async function test(target: string) {
    setTesting(target);
    const res = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const r = await res.json();
    setTestResults((t) => ({ ...t, [target]: r.message ?? r.error }));
    setTesting(null);
  }

  async function createSpreadsheet() {
    const res = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "sheets-create" }),
    });
    const r = await res.json();
    setTestResults((t) => ({ ...t, ["sheets-create"]: r.message }));
  }

  if (!data) return <p className="text-navy-500">Loading integrations…</p>;

  const items: Array<{ key: string; name: string; desc: string }> = [
    { key: "calendar", name: "Google Calendar", desc: "Source of truth for the doctor's working calendar; conflicts are excluded from availability and appointment events are created on booking." },
    { key: "sheets", name: "Google Sheets register", desc: "Operational appointment register and reporting layer (4 worksheets). Never used to lock slots." },
    { key: "email", name: "Email (SMTP)", desc: "Booking confirmations, reminders, cancellations, and staff alerts." },
    { key: "sms", name: "SMS (Twilio)", desc: "Reminders and confirmations via SMS." },
    { key: "avatar", name: "AI receptionist avatar", desc: "Talking receptionist. Local demo avatar is active; connect HeyGen or D-ID for full video lip-sync." },
    { key: "onlineConsult", name: "Online consultations", desc: "Meeting links for online consultations (Google Meet / Jitsi / Zoom / custom)." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-navy-900">Integration Settings</h1>
        <Badge tone={data.demoMode ? "amber" : "green"}>{data.demoMode ? "Demo Mode" : "Live Mode"}</Badge>
      </div>

      {data.demoMode && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Demo Mode:</strong> Google Calendar and/or Sheets are not configured, so availability comes
          from the local schedule only and is clearly labeled as demo. Connect credentials to go live.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => {
          const st = data.status[item.key];
          const reqs = data.requirements[item.key] ?? [];
          return (
            <Card key={item.key} className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-navy-900">{item.name}</h2>
                <Badge tone={st === "live" ? "green" : st === "disabled" ? "gray" : "amber"}>
                  {st === "live" ? "Live" : st === "disabled" ? "Disabled" : "Demo"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{item.desc}</p>
              {item.key === "avatar" && (
                <p className="mt-2 rounded-lg bg-navy-50 p-3 text-xs text-navy-600">
                  Active: {data.avatar.provider} · voice {data.avatar.voice ? "on" : "off"} · lip-sync{" "}
                  {data.avatar.lipSync ? "on" : "approximated"} — {data.avatar.note}
                </p>
              )}
              <p className="mt-3 text-xs text-navy-500">
                <strong>Required env vars:</strong> {reqs.join(", ")}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => void test(item.key === "onlineConsult" ? "calendar" : item.key)} disabled={testing !== null}>
                  {testing === item.key ? "Testing…" : "Test connection"}
                </Button>
                {item.key === "sheets" && (
                  <Button variant="ghost" onClick={() => void createSpreadsheet()}>
                    Create register spreadsheet
                  </Button>
                )}
              </div>
              {testResults[item.key] && <p className="mt-2 rounded-lg bg-navy-50 p-2 text-xs text-navy-700" role="status">{testResults[item.key]}</p>}
            </Card>
          );
        })}
      </div>

      {testResults["sheets-create"] && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900" role="status">
          {testResults["sheets-create"]}
        </div>
      )}
    </div>
  );
}
