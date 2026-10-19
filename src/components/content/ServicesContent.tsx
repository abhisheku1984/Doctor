"use client";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

interface ServicesCfg {
  doctor: { name: string };
  booking: { defaultDurationMinutes: number };
  services: Array<{ id: string; name: string; durationMinutes: number; description: string; modes: string[] }>;
}

export default function ServicesContent({ cfg }: { cfg: ServicesCfg }) {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-navy-900">{t("services.title")}</h1>
      <p className="mt-3 max-w-2xl text-navy-600">
        {t("services.intro", { minutes: cfg.booking.defaultDurationMinutes })}
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {cfg.services.map((s) => (
          <article key={s.id} className="rounded-2xl border border-navy-100 bg-white p-7 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-navy-900">{s.name}</h2>
              <Badge tone="teal">{t("common.min", { count: s.durationMinutes })}</Badge>
            </div>
            <p className="mt-3 leading-relaxed text-navy-600">{s.description}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {s.modes.map((m) => (
                  <span key={m} className="rounded-full border border-navy-100 px-3 py-1 text-xs font-medium text-navy-600">
                    {m === "online" ? t("mode.online") : t("mode.inperson")}
                  </span>
                ))}
              </div>
              <Link href={`/book?service=${s.id}`}>
                <Button variant="secondary">{t("services.bookNow")}</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-navy-100 bg-navy-50 p-6 text-sm text-navy-700">
        <strong>{t("services.unsureTitle")}</strong> {t("services.unsureBody", { name: cfg.doctor.name })}
      </div>
    </div>
  );
}
