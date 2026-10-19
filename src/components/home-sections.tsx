import { ReactNode } from "react";

export function Section({
  kicker,
  title,
  description,
  children,
  id,
}: {
  kicker?: string;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">{kicker}</p>}
          <h2 className="font-display mt-2 text-3xl font-semibold text-navy-900 sm:text-4xl">{title}</h2>
          {description && <p className="mt-4 text-base leading-relaxed text-navy-600">{description}</p>}
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

export function CTACard({ title, body, cta, href, highlight }: { title: string; body: string; cta: string; href: string; highlight?: boolean }) {
  return (
    <div className={`grid gap-6 md:grid-cols-2 ${highlight ? "md:grid-cols-1" : ""}`}>
      <a
        href={href}
        className={`group rounded-2xl border p-8 transition-all hover:-translate-y-1 hover:shadow-lift ${
          highlight ? "border-teal-600 bg-teal-600 text-white" : "border-navy-100 bg-white shadow-soft"
        }`}
      >
        <h3 className={`font-display text-2xl font-semibold ${highlight ? "text-white" : "text-navy-900"}`}>{title}</h3>
        <p className={`mt-3 leading-relaxed ${highlight ? "text-teal-50" : "text-navy-600"}`}>{body}</p>
        <span className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${highlight ? "text-white" : "text-teal-700"}`}>
          {cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </a>
    </div>
  );
}
