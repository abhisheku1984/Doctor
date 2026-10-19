"use client";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { availableLangs, LANG_LABELS } from "@/lib/i18n";

export default function AdminHeader() {
  const { t, lang, setLang } = useLanguage();
  return (
    <header className="border-b border-navy-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/admin" className="font-display text-lg font-semibold text-navy-900">
          {t("admin.title")}
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm" aria-label={t("admin.title")}>
          {[
            ["/admin", t("admin.dashboard")],
            ["/admin/appointments", t("admin.appointments")],
            ["/admin/schedule", t("admin.schedule")],
            ["/admin/integrations", t("admin.integrations")],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 font-medium text-navy-600 hover:bg-navy-50 hover:text-navy-900"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-navy-100 p-0.5" role="group" aria-label={t("nav.language")}>
            {availableLangs().map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${lang === l ? "bg-teal-600 text-white" : "text-navy-600 hover:bg-navy-50"}`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <Link href="/" className="text-sm text-navy-500 hover:text-teal-700">{t("admin.viewSite")}</Link>
          <form action="/api/admin/logout" method="post">
            <button className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50">
              {t("admin.signOut")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
