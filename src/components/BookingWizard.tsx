"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select } from "./ui";
import type { DayAvailability, Slot } from "@/lib/booking";

interface WizardProps {
  config: {
    services: Array<{ id: string; name: string; durationMinutes: number; description: string; modes: string[] }>;
    booking: {
      consultationFeeInr: number | string;
      onlineFeeInr?: number | string;
      defaultDurationMinutes: number;
      maxAdvanceDays: number;
      minAdvanceHours: number;
      modes: string[];
      cancellationPolicyHours: number;
    };
    clinic: { name: string; address: string; city: string; state: string; phone: string };
  };
  initialMode?: "in_person" | "online";
}

type Mode = "in_person" | "online";

const feeLabel = (v: number | string) => (typeof v === "number" ? `₹${v}` : v);

export default function BookingWizard({ config, initialMode }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode | null>(initialMode ?? null);

  const [patientName, setPatientName] = useState("");
  const [patientMobile, setPatientMobile] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [isNewPatient, setIsNewPatient] = useState(true);
  const [serviceId, setServiceId] = useState(config.services[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayAvail, setDayAvail] = useState<DayAvailability | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  );

  const service = config.services.find((s) => s.id === serviceId);
  const duration = service?.durationMinutes ?? config.booking.defaultDurationMinutes;
  const fee = mode === "online" && config.booking.onlineFeeInr ? config.booking.onlineFeeInr : config.booking.consultationFeeInr;

  /* ---------------- Step 3: availability ---------------- */
  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const loadDay = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setSelectedTime(null);
    try {
      const res = await fetch(`/api/availability?date=${date}&mode=${mode ?? "in_person"}`);
      const data = await res.json();
      setDayAvail(data.open ? data : null);
    } catch {
      setDayAvail(null);
    } finally {
      setLoadingSlots(false);
    }
  }, [mode]);

  useEffect(() => {
    if (step === 3 && selectedDate) void loadDay(selectedDate);
  }, [step, selectedDate, loadDay]);

  /* ---------------- Validation ---------------- */
  const errors: Record<string, string> = {};
  if (step === 2) {
    if (patientName.trim().length < 2) errors.patientName = "Please enter the patient's name.";
    if (!/^[6-9]\d{9}$/.test(patientMobile)) errors.patientMobile = "Enter a valid 10-digit Indian mobile number.";
    if (patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) errors.patientEmail = "Enter a valid email or leave blank.";
    if (!consent) errors.consent = "Please confirm you agree to receive appointment updates.";
  }

  /* ---------------- Submit ---------------- */
  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": idempotencyKey },
        body: JSON.stringify({
          patientName, patientMobile, patientEmail: patientEmail || undefined,
          isNewPatient, mode, serviceId, date: selectedDate, time: selectedTime,
          notes: notes || undefined, consentReminders: consent,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        // Slot was taken — refresh alternatives inline.
        setError("That slot was just taken. Here are the latest available times.");
        await loadDay(selectedDate!);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Booking failed. Please try again.");
        return;
      }
      router.push(`/booking/confirmation?ref=${data.appointment.id}`);
    } catch {
      setError("Something went wrong. Your appointment was NOT booked — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Render helpers ---------------- */
  const steps = ["Mode", "Details", "Slot", "Review"];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2" aria-label="Booking progress">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                aria-current={active ? "step" : undefined}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active ? "bg-teal-600 text-white" : done ? "bg-teal-100 text-teal-700" : "bg-navy-100 text-navy-400"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className={`hidden text-sm font-medium sm:block ${active ? "text-navy-900" : "text-navy-400"}`}>{label}</span>
              {n < steps.length && <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {/* Step 1 — mode */}
      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {config.booking.modes.includes("in_person") && (
            <button
              type="button"
              onClick={() => { setMode("in_person"); setStep(2); }}
              className={`group rounded-2xl border-2 p-6 text-left transition-all hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                mode === "in_person" ? "border-teal-600 bg-teal-50" : "border-navy-100 bg-white"
              }`}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-teal-300">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-display text-xl font-semibold text-navy-900">In-Person Consultation</h3>
              <p className="mt-1 text-sm text-navy-600">At the clinic — {config.clinic.name !== "[TO BE CONFIGURED]" ? config.clinic.name : "clinic address to be published"}</p>
              <p className="mt-4 text-sm">
                <span className="font-display text-2xl font-semibold text-teal-700">{feeLabel(fee)}</span>
                <span className="text-navy-500"> · {duration} min</span>
              </p>
            </button>
          )}
          {config.booking.modes.includes("online") && (
            <button
              type="button"
              onClick={() => { setMode("online"); setStep(2); }}
              className={`group rounded-2xl border-2 p-6 text-left transition-all hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                mode === "online" ? "border-teal-600 bg-teal-50" : "border-navy-100 bg-white"
              }`}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M23 7l-7 5 7 5V7zM1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-display text-xl font-semibold text-navy-900">Online Consultation</h3>
              <p className="mt-1 text-sm text-navy-600">Video/phone from home — joining instructions sent before your visit</p>
              <p className="mt-4 text-sm">
                <span className="font-display text-2xl font-semibold text-teal-700">
                  {feeLabel(config.booking.onlineFeeInr ?? config.booking.consultationFeeInr)}
                </span>
                <span className="text-navy-500"> · {duration} min</span>
              </p>
            </button>
          )}
          {step === 1 && <p className="mt-6 text-sm text-navy-500">All consultations are {config.booking.defaultDurationMinutes} minutes by default. Times shown in Asia/Kolkata.</p>}
        </div>
      )}

      {/* Step 2 — details */}
      {step === 2 && (
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-navy-900">Your details</h2>
          <p className="mt-1 text-sm text-navy-500">Only the minimum necessary information is collected.</p>

          <div className="mt-6 space-y-5">
            <Field label="Patient name" error={errors.patientName}>
              <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Full name" autoComplete="name" aria-invalid={!!errors.patientName} />
            </Field>

            <Field label="Mobile number" error={errors.patientMobile} hint="10-digit Indian mobile — used only for appointment updates">
              <Input inputMode="tel" maxLength={10} value={patientMobile} onChange={(e) => setPatientMobile(e.target.value.replace(/\D/g, ""))} placeholder="98765 43210" autoComplete="tel" aria-invalid={!!errors.patientMobile} />
            </Field>

            <Field label="Email (optional)" error={errors.patientEmail}>
              <Input type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-invalid={!!errors.patientEmail} />
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-navy-800">Patient type</legend>
              <div className="flex gap-2">
                {([["new", "New patient"], ["returning", "Returning patient"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setIsNewPatient(v === "new")}
                    aria-pressed={(v === "new") === isNewPatient}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      (v === "new") === isNewPatient ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label="Service">
              <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {config.services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.durationMinutes} min</option>
                ))}
              </Select>
            </Field>

            <Field label="Note for the clinic (optional)" hint="Administrative notes only — please don't include medical details">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="e.g. prefer morning slots" />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 bg-navy-50/50 p-4">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-navy-300 accent-teal-600" />
              <span className="text-sm text-navy-700">
                I agree to receive appointment confirmations and reminders by {patientMobile ? `SMS on ${patientMobile}` : "SMS"}
                {patientEmail ? ` and email` : ""}. I understand my details are used only for this appointment.
              </span>
            </label>
            {errors.consent && <p role="alert" className="text-xs font-medium text-red-600">{errors.consent}</p>}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={Object.keys(errors).length > 0} onClick={() => setStep(3)}>
                Continue to pick a slot
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3 — slot picker */}
      {step === 3 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-navy-900">
                {monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </h3>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => setMonthOffset((o) => Math.max(0, o - 1))} disabled={monthOffset === 0} aria-label="Previous month">‹</Button>
                <Button variant="ghost" onClick={() => setMonthOffset((o) => Math.min(2, o + 1))} disabled={monthOffset >= 2} aria-label="Next month">›</Button>
              </div>
            </div>
            <CalendarGrid monthDate={monthDate} selected={selectedDate} onSelect={setSelectedDate} />
          </Card>

          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              {selectedDate ? new Date(`${selectedDate}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "Available times"}
            </h3>
            {!selectedDate && <p className="mt-6 text-sm text-navy-500">Pick a date to see available times.</p>}
            {selectedDate && loadingSlots && <p className="mt-6 text-sm text-navy-500" role="status">Checking live availability…</p>}
            {selectedDate && !loadingSlots && dayAvail === null && (
              <p className="mt-6 text-sm text-navy-600">The clinic is closed on this day.</p>
            )}
            {selectedDate && !loadingSlots && dayAvail && (
              <div className="mt-4 grid grid-cols-3 gap-2" role="listbox" aria-label="Available time slots">
                {dayAvail.slots.map((s: Slot) => (
                  <button
                    key={s.time}
                    role="option"
                    aria-selected={selectedTime === s.time}
                    disabled={!s.available}
                    onClick={() => setSelectedTime(s.time)}
                    className={`rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors ${
                      selectedTime === s.time
                        ? "border-teal-600 bg-teal-600 text-white"
                        : s.available
                          ? "border-navy-200 text-navy-700 hover:border-teal-500 hover:text-teal-700"
                          : "cursor-not-allowed border-navy-100 bg-navy-50 text-navy-300 line-through"
                    }`}
                  >
                    {formatSlot(s.time)}
                  </button>
                ))}
              </div>
            )}
            {selectedDate && dayAvail && !dayAvail.slots.some((s) => s.available) && (
              <p className="mt-4 text-sm text-amber-700">No free slots this day — please pick another date.</p>
            )}
          </Card>
        </div>
      )}

      {/* Step 4 — review */}
      {step === 4 && (
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-navy-900">Review your appointment</h2>
          <dl className="mt-6 divide-y divide-navy-100 text-sm">
            <Row k="Doctor" v="Dr. XYZ" />
            <Row k="Service" v={service?.name ?? "General Consultation"} />
            <Row k="Mode" v={mode === "online" ? "Online consultation" : "In-person consultation"} />
            <Row k="Date" v={selectedDate ? new Date(`${selectedDate}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""} />
            <Row k="Time" v={selectedTime ? formatSlot(selectedTime) + " (Asia/Kolkata)" : ""} />
            <Row k="Duration" v={`${duration} minutes`} />
            <Row k="Patient" v={patientName} />
            <Row k="Mobile" v={`+91 ${patientMobile}`} />
            {patientEmail && <Row k="Email" v={patientEmail} />}
            <Row k="Fee" v={feeLabel(fee)} />
          </dl>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(3)} disabled={submitting}>Back</Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Booking…" : "Confirm booking"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-navy-400">
            By confirming, you agree to the clinic's terms. Cancellation is free up to {config.booking.cancellationPolicyHours} hours before your slot.
          </p>
        </Card>
      )}

      {/* Navigation for step 3 */}
      {step === 3 && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
          <Button disabled={!selectedDate || !selectedTime} onClick={() => setStep(4)}>
            Continue to review
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-navy-500">{k}</dt>
      <dd className="font-medium text-navy-900">{v}</dd>
    </div>
  );
}

function formatSlot(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

function CalendarGrid({ monthDate, selected, onSelect }: { monthDate: Date; selected: string | null; onSelect: (d: string) => void }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toLocaleDateString("en-CA");
  const cells: Array<string | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return (
    <div role="grid" aria-label="Choose a date">
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold uppercase text-navy-400" role="row">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} role="columnheader">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="rowgroup">
        {cells.map((key, i) => {
          if (!key) return <span key={`e-${i}`} />;
          const disabled = key < todayKey;
          const isSel = selected === key;
          return (
            <button
              key={key}
              role="gridcell"
              disabled={disabled}
              onClick={() => onSelect(key)}
              aria-selected={isSel}
              className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
                disabled
                  ? "cursor-not-allowed text-navy-200"
                  : isSel
                    ? "bg-teal-600 text-white shadow-soft"
                    : "text-navy-700 hover:bg-teal-50"
              }`}
            >
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
