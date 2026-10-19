"use client";

import { Button } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

/** Error & recovery page — graceful failure, no sensitive detail leaked. */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useLanguage();
  console.error("[site error]", error);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold text-navy-900">{t("err.title")}</h1>
      <p className="mt-3 text-navy-600">{t("err.desc")}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>{t("err.retry")}</Button>
        <Button variant="secondary" onClick={() => history.back()}>{t("err.back")}</Button>
      </div>
      <p className="mt-6 text-sm text-navy-500">{t("err.stuck", { num: "112" })}</p>
    </div>
  );
}
