import { getConfig, isConfigured } from "@/lib/config";
import { getAppointment, bookingSummary } from "@/lib/booking";
import { displayDate, displayTime } from "@/lib/time";
import { Button, Card, Badge } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Booking Confirmation" };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const cfg = getConfig();

  if (!ref) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy-900">No appointment reference</h1>
        <p className="mt-3 text-navy-600">Use the link from your booking confirmation.</p>
        <Link href="/book" className="mt-6 inline-block"><Button>Book an appointment</Button></Link>
      </div>
    );
  }

  const apt = getAppointment(ref.toUpperCase());
  if (!apt) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Appointment not found</h1>
        <p className="mt-3 text-navy-600">Check the reference and try again.</p>
        <Link href="/appointments/lookup" className="mt-6 inline-block"><Button>Look up my appointment</Button></Link>
      </div>
    );
  }

  const s = bookingSummary(apt);
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Card className="p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy-900">Appointment confirmed</h1>
            <p className="text-sm text-navy-500">A confirmation is being sent to your registered contact.</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-navy-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">Appointment reference</p>
          <p className="font-display text-2xl font-semibold tracking-wide text-navy-900">{s.reference}</p>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <Row k="Doctor" v={s.doctor} />
          <Row k="Consultation" v={s.modeLabel} />
          <Row k="Service" v={s.service} />
          <Row k="Date" v={s.date} />
          <Row k="Time" v={`${s.time} (${apt.duration_min} min)`} />
          <Row k="Fee" v={s.fee} />
          {s.onlineLink && <Row k="Join link" v={s.onlineLink} link />}
        </dl>

        {apt.mode === "online" && !s.onlineLink && (
          <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
            Online consultations: joining instructions will be sent to your registered mobile/email before the appointment.
          </p>
        )}
        {apt.mode === "in_person" && (
          <p className="mt-4 rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
            {isConfigured(cfg.clinic.address)
              ? `Venue: ${cfg.clinic.address}, ${cfg.clinic.city}, ${cfg.clinic.state}. Please arrive 5 minutes early with a photo ID.`
              : "Please arrive 5 minutes early with a photo ID. The clinic address will be shared shortly."}
          </p>
        )}

        <div className="mt-6 rounded-xl border border-navy-100 p-4 text-sm text-navy-600">
          <strong className="text-navy-900">Need to change plans?</strong> You can reschedule or cancel free of
          charge up to {cfg.booking.cancellationPolicyHours} hours before your slot, using your reference and mobile
          number on the <Link className="font-semibold text-teal-700 hover:underline" href="/appointments/lookup">appointment lookup page</Link>.
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/"><Button variant="secondary">Back to home</Button></Link>
          <Link href="/appointments/lookup"><Button>Manage appointment</Button></Link>
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v, link }: { k: string; v: string; link?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-100 pb-2 last:border-0">
      <dt className="text-navy-500">{k}</dt>
      <dd className={`text-right font-medium ${link ? "break-all text-teal-700" : "text-navy-900"}`}>{v}</dd>
    </div>
  );
}
