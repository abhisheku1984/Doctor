import { getConfig } from "@/lib/config";
import TermsContent from "@/components/content/TermsContent";

export const metadata = { title: "Terms & Cancellation Policy" };

export default function TermsPage() {
  const cfg = getConfig();
  return (
    <TermsContent
      defaultDurationMinutes={cfg.booking.defaultDurationMinutes}
      cancellationPolicyHours={cfg.booking.cancellationPolicyHours}
      doctorName={cfg.doctor.name}
    />
  );
}
