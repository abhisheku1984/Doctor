import { getConfig, isConfigured } from "@/lib/config";
import { Card } from "@/components/ui";

export const metadata = { title: "Contact & Clinic Location" };

export default function ContactPage() {
  const cfg = getConfig();
  const c = cfg.clinic;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-navy-900">Contact &amp; Clinic Location</h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="p-7">
          <h2 className="font-display text-xl font-semibold text-navy-900">Visit us</h2>
          <address className="mt-4 space-y-2 not-italic text-sm text-navy-700">
            <p>{isConfigured(c.address) ? c.address : "Address to be published"}</p>
            <p>{isConfigured(c.city) ? `${c.city}, ${c.state}${c.pincode ? ` ${c.pincode}` : ""}` : "City & state to be published"}</p>
            {c.mapsUrl && (
              <a href={c.mapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 hover:underline">
                Get directions →
              </a>
            )}
          </address>
          <div className="mt-6 space-y-2 text-sm">
            <p><span className="font-medium text-navy-900">Phone:</span> {isConfigured(c.phone) ? c.phone : "To be published"}</p>
            <p><span className="font-medium text-navy-900">Email:</span> {isConfigured(c.email) ? c.email : "To be published"}</p>
            <p><span className="font-medium text-navy-900">Hours:</span> {typeof cfg.booking.workingHours === "string" ? cfg.booking.workingHours : "To be published"} (Asia/Kolkata)</p>
          </div>
        </Card>

        <Card className="p-7">
          <h2 className="font-display text-xl font-semibold text-navy-900">Support</h2>
          <p className="mt-4 text-sm leading-relaxed text-navy-600">
            For appointments, cancellations, or rescheduling, use the online booking tools or call the
            clinic during working hours. For medical emergencies in India, call <strong>112</strong>.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-navy-700">
            <li>• Booking help: the AI receptionist (bottom-right of this page)</li>
            <li>• Appointment lookup: <a className="font-semibold text-teal-700 hover:underline" href="/appointments/lookup">/appointments/lookup</a></li>
            <li>• Feedback: email the clinic</li>
          </ul>
        </Card>
      </div>

      <div className="mt-10">
        {c.mapsUrl ? (
          <iframe
            title="Clinic location map"
            src={c.mapsUrl}
            className="h-80 w-full rounded-2xl border border-navy-100"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="relative h-64 overflow-hidden rounded-2xl border border-navy-100">
            <img src="/images/clinic-exterior.jpg" alt="Clinic exterior" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-navy-950/40">
              <p className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-navy-800">
                Map will appear once the clinic configures its Google Maps link.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
