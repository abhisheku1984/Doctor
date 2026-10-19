"use client";
import { isConfigured } from "@/lib/config-shared";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

interface ContactCfg {
  clinic: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    mapsUrl: string;
    emergencyNumber: string;
  };
  booking: { workingHours: string | { start: string; end: string } };
}

export default function ContactContent({ cfg }: { cfg: ContactCfg }) {
  const { t } = useLanguage();
  const c = cfg.clinic;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-navy-900">{t("contact.title")}</h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="p-7">
          <h2 className="font-display text-xl font-semibold text-navy-900">{t("contact.visit")}</h2>
          <address className="mt-4 space-y-2 not-italic text-sm text-navy-700">
            <p>{isConfigured(c.address) ? c.address : t("contact.addressTBP")}</p>
            <p>{isConfigured(c.city) ? `${c.city}, ${c.state}${c.pincode ? ` ${c.pincode}` : ""}` : t("contact.cityTBP")}</p>
            {c.mapsUrl && (
              <a href={c.mapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 hover:underline">
                {t("contact.directions")}
              </a>
            )}
          </address>
          <div className="mt-6 space-y-2 text-sm">
            <p><span className="font-medium text-navy-900">{t("contact.phone")}</span> {isConfigured(c.phone) ? c.phone : t("common.toPublished")}</p>
            <p><span className="font-medium text-navy-900">{t("contact.email")}</span> {isConfigured(c.email) ? c.email : t("common.toPublished")}</p>
            <p><span className="font-medium text-navy-900">{t("contact.hours")}</span> {typeof cfg.booking.workingHours === "string" ? cfg.booking.workingHours : t("common.toPublished")} (Asia/Kolkata)</p>
          </div>
        </Card>

        <Card className="p-7">
          <h2 className="font-display text-xl font-semibold text-navy-900">{t("contact.support")}</h2>
          <p className="mt-4 text-sm leading-relaxed text-navy-600">
            {t("contact.supportBody", { num: c.emergencyNumber || "112" })}
          </p>
          <ul className="mt-5 space-y-2 text-sm text-navy-700">
            <li>{t("contact.helpBooking")}</li>
            <li>{t("contact.helpLookup")} <a className="font-semibold text-teal-700 hover:underline" href="/appointments/lookup">/appointments/lookup</a></li>
            <li>{t("contact.helpFeedback")}</li>
          </ul>
        </Card>
      </div>

      <div className="mt-10">
        {c.mapsUrl ? (
          <iframe
            title={t("contact.mapTitle")}
            src={c.mapsUrl}
            className="h-80 w-full rounded-2xl border border-navy-100"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="relative h-64 overflow-hidden rounded-2xl border border-navy-100">
            <img src="/images/clinic-exterior.jpg" alt={t("contact.mapAlt")} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-navy-950/40">
              <p className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-navy-800">
                {t("contact.mapPending")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
