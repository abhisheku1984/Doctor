import { getConfig } from "@/lib/config";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const cfg = getConfig();
  const year = new Date().getFullYear();
  return (
    <div className="prose mx-auto max-w-3xl px-4 py-16 prose-headings:font-display prose-headings:text-navy-900 prose-a:text-teal-700">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-navy-500">Last updated: {new Date().toISOString().slice(0, 10)} · {cfg.clinic.name !== "[TO BE CONFIGURED]" ? cfg.clinic.name : "The Clinic"}</p>

      <h2>What we collect</h2>
      <p>We collect the <strong>minimum necessary</strong> information to book and manage your appointment:</p>
      <ul>
        <li>Patient name and mobile number (required to book)</li>
        <li>Email address (optional, for confirmations)</li>
        <li>Appointment preferences: date, time, consultation mode, service</li>
        <li>Your consent choices for reminders</li>
      </ul>
      <p><strong>We do not collect</strong> diagnoses, medical histories, prescriptions, or government ID numbers through this website.</p>

      <h2>How we use it</h2>
      <p>Your details are used only to schedule, confirm, reschedule, or cancel your appointment and to send appointment-related messages where you have consented.</p>

      <h2>Where it is stored</h2>
      <ul>
        <li><strong>Booking backend:</strong> a transactional database on the clinic&apos;s server (source of truth).</li>
        <li><strong>Google Calendar:</strong> event titles contain only your booking reference — never your name.</li>
        <li><strong>Google Sheets register:</strong> the clinic&apos;s private appointment register, accessible only to authorized clinic staff and the secured backend.</li>
        <li><strong>AI receptionist:</strong> chat context is stored temporarily per session to complete a booking; voice processing, when enabled, uses the configured provider under its own data terms.</li>
      </ul>

      <h2>Retention &amp; deletion</h2>
      <p>Appointment records are retained per the clinic&apos;s record-keeping obligations. To request deletion of your contact details from the booking system, call the clinic and quote your appointment reference.</p>

      <h2>Sharing</h2>
      <p>Your information is shared only with clinic staff who need it to run your appointment, and with trusted providers (Google, email/SMS services) strictly to deliver the service. We never sell your data.</p>

      <h2>Security</h2>
      <p>Production deployments serve over HTTPS; admin access is authenticated and authorized server-side; patient data is never exposed through public URLs or frontend logs.</p>

      <h2>Your rights (India)</h2>
      <p>Under applicable Indian privacy law you may request access, correction, or deletion of your personal information by contacting the clinic. This policy is a template — the clinic must complete a legal review before launch (see docs/LAUNCH.md).</p>

      <h2>Emergency notice</h2>
      <p>This website is not for medical emergencies. In India, call <strong>112</strong>.</p>
    </div>
  );
}
