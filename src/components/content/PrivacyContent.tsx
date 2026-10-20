"use client";
import { useLanguage } from "@/components/LanguageProvider";

export default function PrivacyContent({ clinicName }: { clinicName: string }) {
  const { t } = useLanguage();
  return (
    <div className="prose mx-auto max-w-3xl px-4 py-16 prose-headings:font-display prose-headings:text-navy-900 prose-a:text-teal-700">
      <h1>{t("privacy.title")}</h1>
      <p className="text-sm text-navy-500">
        {t("privacy.updated", {
          date: new Date().toISOString().slice(0, 10),
          clinic: clinicName || t("privacy.clinicFallback"),
        })}
      </p>

      <h2>{t("privacy.collectTitle")}</h2>
      <p>{t("privacy.collectIntro")}</p>
      <ul>
        <li>{t("privacy.collect1")}</li>
        <li>{t("privacy.collect2")}</li>
        <li>{t("privacy.collect3")}</li>
        <li>{t("privacy.collect4")}</li>
      </ul>
      <p><strong>{t("privacy.noCollect")}</strong></p>

      <h2>{t("privacy.useTitle")}</h2>
      <p>{t("privacy.use")}</p>
      <h2>Identified visitor analytics and sign-in</h2>
      <p>Access to the website requires Google sign-in followed by mobile OTP verification, or mobile-number OTP sign-in. If you agree at sign-in, we link your account name, verified mobile number (and Google email where applicable), page paths, timestamps, and basic device category to record visits and improve site operations. We do not store full IP addresses for this analytics feature; the server stores a one-way hash. Admin users with the required role can view the identified visitor list. If you do not agree, do not continue to the website. You can contact the hospital to ask about access, correction, or deletion of your account and visit data.</p>

      <h2>{t("privacy.storeTitle")}</h2>
      <ul>
        <li><strong>{t("privacy.store1").split(":")[0]}:</strong>{t("privacy.store1").split(":").slice(1).join(":")}</li>
        <li><strong>{t("privacy.store2").split(":")[0]}:</strong>{t("privacy.store2").split(":").slice(1).join(":")}</li>
        <li><strong>{t("privacy.store3").split(":")[0]}:</strong>{t("privacy.store3").split(":").slice(1).join(":")}</li>
        <li><strong>{t("privacy.store4").split(":")[0]}:</strong>{t("privacy.store4").split(":").slice(1).join(":")}</li>
      </ul>

      <h2>{t("privacy.retentionTitle")}</h2>
      <p>{t("privacy.retention")}</p>

      <h2>{t("privacy.shareTitle")}</h2>
      <p>{t("privacy.share")}</p>

      <h2>{t("privacy.securityTitle")}</h2>
      <p>{t("privacy.security")}</p>

      <h2>{t("privacy.rightsTitle")}</h2>
      <p>{t("privacy.rights")}</p>

      <h2>{t("privacy.emergencyTitle")}</h2>
      <p>{t("privacy.emergency", { num: "112" })}</p>
    </div>
  );
}
