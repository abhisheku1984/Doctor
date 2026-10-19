"use client";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

export default function Footer({
  doctorName,
  clinicName,
  emergencyNumber,
}: {
  doctorName: string;
  clinicName: string;
  emergencyNumber: string;
}) {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-navy-100 bg-navy-950 text-navy-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="font-display text-xl font-semibold text-white">{doctorName}</p>
          <p className="mt-1 text-sm text-navy-300">{clinicName || t("footer.taglineFallback")}</p>
          <p className="mt-4 text-xs leading-relaxed text-navy-400">{t("footer.disclaimer")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">{t("footer.quickLinks")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-teal-300" href="/book">{t("footer.book")}</Link></li>
            <li><Link className="hover:text-teal-300" href="/services">{t("footer.services")}</Link></li>
            <li><Link className="hover:text-teal-300" href="/appointments/lookup">{t("footer.lookup")}</Link></li>
            <li><Link className="hover:text-teal-300" href="/privacy">{t("footer.privacy")}</Link></li>
            <li><Link className="hover:text-teal-300" href="/terms">{t("footer.terms")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">{t("footer.emergencyTitle")}</p>
          <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            {t("footer.emergencyBody", { number: emergencyNumber || "112" })}
          </p>
        </div>
      </div>
      <div className="border-t border-navy-800 py-4 text-center text-xs text-navy-400">
        {t("footer.rights", { year: new Date().getFullYear(), name: doctorName })}
      </div>
    </footer>
  );
}
