"use client";

import { useState } from "react";
import { Card, Button, Input, Field, Badge } from "@/components/ui";

interface BookingDetail {
  reference: string;
  doctor: string;
  mode: string;
  modeLabel: string;
  date: string;
  time: string;
  duration: string;
  service: string;
  fee: string;
  onlineLink: string | null;
}

export default function LookupPage() {
  const [ref, setRef] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(ref.trim())}?mobile=${encodeURIComponent(mobile.trim())}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Not found."); setBooking(null); return; }
      setBooking(data.appointment);
      setStatus(data.raw.status);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string) {
    if (!booking) return;
    if (action === "cancel" && !window.confirm("Cancel this appointment?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${booking.reference}?mobile=${encodeURIComponent(mobile)}&action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "cancel" ? JSON.stringify({}) : JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Request failed."); return; }
      setMessage(action === "cancel" ? "Appointment cancelled." : "Appointment updated.");
      setBooking(data.appointment);
      setStatus("cancelled");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-navy-900">Appointment Lookup</h1>
      <p className="mt-2 text-navy-600">Find, cancel, or reschedule your appointment using your booking reference and registered mobile number.</p>

      <Card className="mt-8 p-6">
        <form onSubmit={lookup} className="space-y-4">
          <Field label="Appointment reference" error={!ref ? undefined : undefined}>
            <Input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="APT-XXXXXXXX" required />
          </Field>
          <Field label="Registered mobile number">
            <Input inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" required />
          </Field>
          <Button type="submit" disabled={busy || !ref || mobile.length !== 10}>
            {busy ? "Looking up…" : "Find appointment"}
          </Button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </Card>

      {booking && (
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-navy-900">{booking.reference}</h2>
            <Badge tone={status === "confirmed" ? "green" : "amber"}>{status}</Badge>
          </div>
          <dl className="mt-5 space-y-2 text-sm">
            <Row k="Doctor" v={booking.doctor} />
            <Row k="Mode" v={booking.modeLabel} />
            <Row k="Service" v={booking.service} />
            <Row k="Date" v={booking.date} />
            <Row k="Time" v={`${booking.time} (${booking.duration})`} />
            <Row k="Fee" v={booking.fee} />
          </dl>
          {booking.onlineLink && (
            <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
              Join online: <a className="font-semibold underline" href={booking.onlineLink}>{booking.onlineLink}</a>
            </p>
          )}
          {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          {status === "confirmed" && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void act("reschedule")}>Request reschedule</Button>
              <Button variant="danger" onClick={() => void act("cancel")} disabled={busy}>Cancel appointment</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-100 pb-2 last:border-0">
      <dt className="text-navy-500">{k}</dt>
      <dd className="text-right font-medium text-navy-900">{v}</dd>
    </div>
  );
}
