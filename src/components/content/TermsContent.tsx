"use client";
import { useLanguage } from "@/components/LanguageProvider";

export default function TermsContent({
  defaultDurationMinutes,
  cancellationPolicyHours,
  doctorName,
}: {
  defaultDurationMinutes: number;
  cancellationPolicyHours: number;
  doctorName: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="prose mx-auto max-w-3xl px-4 py-16 prose-headings:font-display prose-headings:text-navy-900 prose-a:text-teal-700">
      <h1>{t("terms.title")}</h1>

      <h2>{t("terms.bookingTitle")}</h2>
      <ul>
        <li>{t("terms.booking1", { minutes: defaultDurationMinutes })}</li>
        <li>{t("terms.booking2")}</li>
        <li>{t("terms.booking3")}</li>
        <li>{t("terms.booking4")}</li>
      </ul>

      <h2>{t("terms.cancelTitle")}</h2>
      <ul>
        <li>{t("terms.cancel1", { hours: cancellationPolicyHours })}</li>
        <li>{t("terms.cancel2", { hours: cancellationPolicyHours })}</li>
        <li>{t("terms.cancel3")}</li>
        <li>{t("terms.cancel4")}</li>
      </ul>

      <h2>{t("terms.aiTitle")}</h2>
      <p>{t("terms.ai", { name: doctorName })}</p>

      <h2>{t("terms.useTitle")}</h2>
      <ul>
        <li>{t("terms.use1")}</li>
        <li>{t("terms.use2")}</li>
        <li>{t("terms.use3")}</li>
      </ul>

      <h2>{t("terms.emergencyTitle")}</h2>
      <p>{t("terms.emergency", { num: "112" })}</p>
    </div>
  );
}
