"use client";
import { useLanguage } from "./LanguageProvider";

/** Skip-to-content link — translated. */
export default function SkipLink() {
  const { t } = useLanguage();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-teal-600 focus:text-white focus:px-4 focus:py-2 focus:m-2"
    >
      {t("common.skip")}
    </a>
  );
}
