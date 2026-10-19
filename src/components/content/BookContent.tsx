"use client";
import BookingWizard from "@/components/BookingWizard";
import { useLanguage } from "@/components/LanguageProvider";

interface BookCfg {
  services: Array<{ id: string; name: string; durationMinutes: number; description: string; modes: string[] }>;
  booking: {
    consultationFeeInr: number | string;
    onlineFeeInr?: number | string;
    defaultDurationMinutes: number;
    maxAdvanceDays: number;
    minAdvanceHours: number;
    modes: string[];
    cancellationPolicyHours: number;
  };
  clinic: { name: string; address: string; city: string; state: string; phone: string };
}

export default function BookContent({
  cfg,
  initialMode,
}: {
  cfg: BookCfg;
  initialMode?: "in_person" | "online";
}) {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="font-display text-4xl font-semibold text-navy-900">{t("book.title")}</h1>
        <p className="mt-3 text-navy-600">
          {t("book.subtitle", { zone: "Asia/Kolkata" })}
        </p>
      </header>

      <BookingWizard config={cfg} initialMode={initialMode} />
    </div>
  );
}
