import { getConfig, isConfigured } from "@/lib/config";
import { getAppointment, bookingSummary } from "@/lib/booking";
import ConfirmationContent from "@/components/content/ConfirmationContent";

export const metadata = { title: "Booking Confirmation" };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const cfg = getConfig();

  if (!ref) {
    return (
      <ConfirmationContent
        state="no-ref"
        summary={null}
        durationMin={cfg.booking.defaultDurationMinutes}
        clinicAddress=""
        cancellationPolicyHours={cfg.booking.cancellationPolicyHours}
      />
    );
  }

  const apt = getAppointment(ref.toUpperCase());
  if (!apt) {
    return (
      <ConfirmationContent
        state="not-found"
        summary={null}
        durationMin={cfg.booking.defaultDurationMinutes}
        clinicAddress=""
        cancellationPolicyHours={cfg.booking.cancellationPolicyHours}
      />
    );
  }

  const s = bookingSummary(apt);
  return (
    <ConfirmationContent
      state="ok"
      summary={s}
      durationMin={apt.duration_min}
      clinicAddress={
        isConfigured(cfg.clinic.address)
          ? `${cfg.clinic.address}, ${cfg.clinic.city}, ${cfg.clinic.state}`
          : ""
      }
      cancellationPolicyHours={cfg.booking.cancellationPolicyHours}
    />
  );
}
