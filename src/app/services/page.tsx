import { getConfig } from "@/lib/config";
import { Badge, Button } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Specialities & Services" };

export default function ServicesPage() {
  const cfg = getConfig();
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-navy-900">Specialities &amp; Services</h1>
      <p className="mt-3 max-w-2xl text-navy-600">
        Every consultation is {cfg.booking.defaultDurationMinutes} minutes by default. Fees are confirmed at booking.
        Times shown are in Asia/Kolkata.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {cfg.services.map((s) => (
          <article key={s.id} className="rounded-2xl border border-navy-100 bg-white p-7 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-navy-900">{s.name}</h2>
              <Badge tone="teal">{s.durationMinutes} min</Badge>
            </div>
            <p className="mt-3 leading-relaxed text-navy-600">{s.description}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {s.modes.map((m) => (
                  <span key={m} className="rounded-full border border-navy-100 px-3 py-1 text-xs font-medium text-navy-600">
                    {m === "online" ? "Online" : "In-person"}
                  </span>
                ))}
              </div>
              <Link href={`/book?service=${s.id}`}>
                <Button variant="secondary">Book now</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-navy-100 bg-navy-50 p-6 text-sm text-navy-700">
        <strong>Not sure what you need?</strong> Book a general consultation — {cfg.doctor.name} will guide you,
        or ask the AI receptionist on this page.
      </div>
    </div>
  );
}
