"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";

/**
 * Visible in Demo Mode (Google integrations not yet configured).
 * Never hidden — the spec requires Demo Mode to be visibly
 * different from Live Mode.
 */
export function DemoModeBanner() {
  const { t } = useLanguage();
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    fetch("/api/config/public")
      .then((r) => r.json())
      .then((c) => setDemo(!!c.demoMode))
      .catch(() => setDemo(true));
  }, []);

  if (!demo) return null;
  return (
    <div className="demo-stripes border-b border-amber-300 bg-amber-50" role="status">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs font-medium text-amber-900 sm:px-6 lg:px-8">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <span>{t("demo.banner")}</span>
      </div>
    </div>
  );
}
