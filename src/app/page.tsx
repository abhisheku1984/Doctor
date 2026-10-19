import Link from "next/link";
import { getConfig, isConfigured } from "@/lib/config";
import { displayDate, displayTime } from "@/lib/time";
import { Section, CTACard } from "@/components/home-sections";
import ReceptionistLauncher from "@/components/ReceptionistLauncher";

export default function HomePage() {
  const cfg = getConfig();
  const d = cfg.doctor;
  const c = cfg.clinic;
  const specialityConfigured = isConfigured(d.speciality);
  const hoursConfigured = isConfigured(cfg.booking.workingHours);

  return (
    <>
      {/* ======================= HERO ======================= */}
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-teal-900" aria-hidden="true" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
          <div className="animate-fade-up">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
              {cfg.clinic.name !== "[TO BE CONFIGURED]" ? cfg.clinic.name : "Clinic"} · {isConfigured(c.city) ? `${c.city}, ${c.state}` : "Location to be published"}
            </p>
            <h1 className="font-display mt-4 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {d.name}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-lg text-navy-200">
              {specialityConfigured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 px-3 py-1 text-sm font-medium text-teal-300 ring-1 ring-teal-400/30">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {d.speciality}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm text-navy-200 ring-1 ring-white/15">
                  Speciality to be published
                </span>
              )}
              {isConfigured(d.yearsOfExperience) && <span className="text-navy-300">· {d.yearsOfExperience} years experience</span>}
            </p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-navy-200">
              {specialityConfigured && isConfigured(d.about)
                ? d.about
                : "Book an in-person or online consultation in minutes — with live availability, instant confirmation, and automatic reminders. A warm, professional clinic experience from your first click."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 text-sm font-bold text-navy-950 shadow-lift transition-all hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              >
                Book an Appointment
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <a
                href="#receptionist"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeLinecap="round" /></svg>
                Talk to Our AI Receptionist
              </a>
            </div>

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
              <Link href="/book" className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur transition-colors hover:bg-white/10">
                <p className="text-sm font-semibold text-teal-300">In-Person</p>
                <p className="mt-0.5 text-xs text-navy-300">At the clinic — {isConfigured(cfg.booking.consultationFeeInr) ? (typeof cfg.booking.consultationFeeInr === "number" ? `₹${cfg.booking.consultationFeeInr}` : cfg.booking.consultationFeeInr) : "fee to be published"}</p>
              </Link>
              <Link href="/book?mode=online" className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur transition-colors hover:bg-white/10">
                <p className="text-sm font-semibold text-teal-300">Online</p>
                <p className="mt-0.5 text-xs text-navy-300">Video/phone from home</p>
              </Link>
            </div>

            {(hoursConfigured || isConfigured(c.address)) && (
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm text-navy-300">
                {hoursConfigured && (
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">Opening hours</dt>
                    <dd>🕐 {typeof cfg.booking.workingHours === "string" ? cfg.booking.workingHours : `${cfg.booking.workingHours.start}–${cfg.booking.workingHours.end}`} · Asia/Kolkata</dd>
                  </div>
                )}
                {isConfigured(c.address) && (
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">Location</dt>
                    <dd>📍 {c.address}{isConfigured(c.city) ? `, ${c.city}` : ""}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          <div className="relative animate-fade-up">
            <div className="relative mx-auto max-w-md">
              <div className="absolute -inset-4 rounded-[2rem] bg-teal-500/20 blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-navy-900 shadow-lift">
                {/* Doctor portrait — replace with the clinic's verified photo */}
                <div className="relative flex aspect-[4/5] flex-col items-center justify-center gap-4 bg-gradient-to-b from-navy-800 to-navy-950 p-8">
                  <img src="/images/doctor-portrait.jpg" alt={d.photoAlt} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/20 to-transparent" aria-hidden="true" />
                  <div className="relative mt-auto text-center">
                    <p className="font-display text-2xl font-semibold text-white">{d.name}</p>
                    {specialityConfigured ? (
                      <p className="text-sm text-teal-300">{d.speciality}</p>
                    ) : (
                      <span className="mt-1 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-navy-100">Photo to be replaced with the clinic's verified portrait</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between bg-white/5 px-5 py-3 text-xs text-navy-300 backdrop-blur">
                  <span>{specialityConfigured ? "Verified profile" : "Profile pending verification"}</span>
                  <span>{isConfigured(d.registration.registrationNumber) ? `Reg. ${d.registration.registrationNumber}` : ""}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= TRUST STRIP ======================= */}
      <section className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-5 text-sm text-navy-600 sm:px-6">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-teal-500" /> Live availability</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-teal-500" /> Instant confirmation</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-teal-500" /> In-person &amp; online</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-teal-500" /> Free rescheduling</span>
        </div>
      </section>

      {/* ======================= ABOUT PREVIEW ======================= */}
      <Section kicker="About" title={`Meet ${d.name}`} description="A trusted name in care — profile details are verified before publication.">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: "🎓", label: "Qualifications", value: isConfigured(d.qualifications) ? d.qualifications.join(", ") : "To be published" },
            { icon: "💼", label: "Experience", value: isConfigured(d.yearsOfExperience) ? `${d.yearsOfExperience} years` : "To be published" },
            { icon: "📋", label: "Registration", value: isConfigured(d.registration.registrationNumber) ? `${d.registration.council} ${d.registration.registrationNumber}` : "To be verified" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft hover-lift">
              <p className="text-2xl" aria-hidden="true">{item.icon}</p>
              <p className="mt-3 text-sm font-semibold text-navy-900">{item.label}</p>
              <p className="mt-1 text-sm text-navy-600">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/about" className="text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline">
            Read the full profile →
          </Link>
        </div>
      </Section>

      {/* ======================= SERVICES ======================= */}
      <Section kicker="Services" title="Specialities & Services" description="Book a consultation in person or online — every service lists its duration and fee transparently.">
        <div className="grid gap-6 sm:grid-cols-2">
          {cfg.services.map((s) => (
            <div key={s.id} className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft hover-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-navy-900">{s.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-600">{s.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{s.durationMinutes} min</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.modes.map((m) => (
                  <span key={m} className="rounded-full border border-navy-100 px-2.5 py-0.5 text-xs text-navy-600">
                    {m === "online" ? "Online" : "In-person"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/services" className="text-sm font-semibold text-teal-700 hover:underline">All services →</Link>
        </div>
      </Section>

      {/* ======================= CONSULTATION OPTIONS ======================= */}
      <Section kicker="Consultation options" title="How would you like to consult?" description="Transparent fees, the same careful attention — in the clinic or from home.">
        <CTACard
          title="In-Person Consultation"
          body="Visit the clinic for a face-to-face consultation. Arrive 5 minutes early with a photo ID."
          cta="Book in-person"
          href="/book?mode=in_person"
        />
        <CTACard
          title="Online Consultation"
          body="Secure video/phone consultation from home. Joining instructions are sent to you before the appointment."
          cta="Book online"
          href="/book?mode=online"
          highlight
        />
      </Section>

      {/* ======================= AI RECEPTIONIST ======================= */}
      <Section id="receptionist" kicker="AI Receptionist" title="Meet your virtual receptionist" description="A friendly assistant for appointments, timings, fees and policies — available right now, on this page.">
        <div className="mx-auto grid max-w-4xl items-center gap-8 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-navy-100 shadow-soft">
            <img src="/images/receptionist-avatar.jpg" alt={`${cfg.avatar.name}, the virtual receptionist`} className="aspect-[4/5] w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/85 to-transparent p-5">
              <p className="font-display text-xl font-semibold text-white">{cfg.avatar.name}</p>
              <p className="text-sm text-teal-300">{cfg.avatar.role}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-gradient-to-br from-navy-50 to-teal-50 p-8">
            <p className="font-display text-lg italic leading-relaxed text-navy-800">
              “{cfg.avatar.introduction}”
            </p>
            <p className="mt-4 text-sm text-navy-500">
              — {cfg.avatar.name}, {cfg.avatar.role}. I can book appointments, check availability, and answer questions about timings, fees and policies. I&apos;m an administrative assistant, not a medical professional.
            </p>
            <ul className="mt-5 space-y-1.5 text-sm text-navy-700">
              <li>✓ Answers only from verified clinic information</li>
              <li>✓ Live appointment availability &amp; guided booking</li>
              <li>✓ Voice &amp; text chat · English, हिंदी, తెలుగు</li>
              <li>✓ Never diagnoses or prescribes</li>
            </ul>
            <div className="mt-6">
              <ReceptionistLauncher className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-5 py-3 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-800" />
            </div>
          </div>
        </div>
      </Section>

      {/* ======================= FAQ ======================= */}
      <Section kicker="FAQ" title="Frequently asked questions" description="Answers from the clinic's approved information.">
        <div className="mx-auto max-w-3xl space-y-3">
          {cfg.faqs.map((f, i) => (
            <details key={i} className="group rounded-xl border border-navy-100 bg-white px-5 py-4 shadow-soft">
              <summary className="cursor-pointer font-medium text-navy-900 marker:text-teal-600">{f.q}</summary>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ======================= CTA ======================= */}
      <section className="bg-teal-600 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Ready to book your visit?</h2>
          <p className="max-w-xl text-teal-50">Live availability, instant confirmation, and automatic reminders — in about a minute.</p>
          <Link
            href="/book"
            className="rounded-xl bg-white px-8 py-4 text-sm font-bold text-navy-950 shadow-lift transition-all hover:bg-teal-50"
          >
            Book an Appointment
          </Link>
        </div>
      </section>
    </>
  );
}
