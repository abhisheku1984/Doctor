import Link from "next/link";
import { getConfig, isConfigured } from "@/lib/config";

export const metadata = { title: "About Dr. XYZ" };

export default function AboutPage() {
  const cfg = getConfig();
  const d = cfg.doctor;
  const c = cfg.clinic;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <nav className="text-sm text-navy-400" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-teal-700">Home</Link> / <span className="text-navy-700">About</span>
      </nav>

      <h1 className="font-display mt-6 text-4xl font-semibold text-navy-900 sm:text-5xl">About {d.name}</h1>

      <div className="mt-10 grid gap-10 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-gradient-to-b from-navy-800 to-navy-950">
            <span className="font-display text-6xl text-teal-300">{d.name.replace("Dr. ", "").slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
        <div className="md:col-span-2">
          <p className="text-lg leading-relaxed text-navy-700">
            {isConfigured(d.about)
              ? d.about
              : "Dr. XYZ's professional biography will be published here once verified by the clinic. We never publish unverified qualifications or claims."}
          </p>

          <dl className="mt-8 divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white shadow-soft">
            {[
              ["Speciality", isConfigured(d.speciality) ? d.speciality : "To be configured"],
              ["Qualifications", isConfigured(d.qualifications) ? d.qualifications.join(", ") : "To be configured"],
              ["Registration", isConfigured(d.registration.registrationNumber) ? `${d.registration.council} — ${d.registration.registrationNumber}` : "To be verified"],
              ["Experience", isConfigured(d.yearsOfExperience) ? `${d.yearsOfExperience} years` : "To be configured"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-4 text-sm">
                <dt className="font-medium text-navy-500">{k}</dt>
                <dd className="text-right font-medium text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Verification notice:</strong> credentials shown here are published only after the clinic verifies
            them against the relevant medical council register.
          </div>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link href="/book" className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-teal-700">
          Book an appointment with {d.name}
        </Link>
      </div>
    </div>
  );
}
