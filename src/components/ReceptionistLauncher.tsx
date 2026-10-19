"use client";

import { useLanguage } from "./LanguageProvider";

/** Opens the floating AI receptionist widget. */
export default function ReceptionistLauncher({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <button
      onClick={() => {
        const btn = document.querySelector<HTMLButtonElement>("button[data-receptionist-toggle]");
        btn?.click();
        btn?.focus();
      }}
      className={className}
    >
      {t("rw.startConv")}
    </button>
  );
}
