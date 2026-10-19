import { getConfig } from "@/lib/config";

export const metadata = { title: "Terms & Cancellation Policy" };

export default function TermsPage() {
  const cfg = getConfig();
  const hours = cfg.booking.cancellationPolicyHours;
  return (
    <div className="prose mx-auto max-w-3xl px-4 py-16 prose-headings:font-display prose-headings:text-navy-900 prose-a:text-teal-700">
      <h1>Terms of Use &amp; Cancellation Policy</h1>

      <h2>Appointment booking</h2>
      <ul>
        <li>Bookings are for one patient per slot; {cfg.booking.defaultDurationMinutes} minutes by default.</li>
        <li>All times are shown in Asia/Kolkata.</li>
        <li>Online consultations require the clinic&apos;s video platform to be configured; joining instructions are sent separately before the appointment.</li>
        <li>The booking system is administrative. It does not provide medical advice, diagnosis, or prescriptions.</li>
      </ul>

      <h2>Cancellation policy</h2>
      <ul>
        <li>Free cancellation and rescheduling up to <strong>{hours} hours</strong> before your appointment.</li>
        <li>Cancellations within {hours} hours of the appointment may incur the consultation fee.</li>
        <li>To cancel or reschedule, use your appointment reference and registered mobile number on the lookup page, or call the clinic.</li>
        <li>Repeated no-shows may require prepayment for future bookings.</li>
      </ul>

      <h2>AI receptionist</h2>
      <p>The virtual receptionist is an administrative assistant. It is not Dr. XYZ, is not a licensed healthcare professional, and cannot diagnose, prescribe, or advise on medical conditions.</p>

      <h2>Website use</h2>
      <ul>
        <li>Do not share your appointment reference publicly.</li>
        <li>You are responsible for keeping your registered mobile number accessible.</li>
        <li>The clinic may update these terms; the date above reflects the latest revision.</li>
      </ul>

      <h2>Emergency</h2>
      <p>If you are experiencing a medical emergency, call <strong>112</strong> immediately instead of booking online.</p>
    </div>
  );
}
