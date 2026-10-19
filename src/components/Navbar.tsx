"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { useClinicConfig } from "./ClinicConfigProvider";
import { availableLangs, LANG_LABELS } from "@/lib/i18n";

const links = [
  { href: "/about", key: "nav.about" },
  { href: "/services", key: "nav.services" },
  { href: "/book", key: "nav.book" },
  { href: "/contact", key: "nav.contact" },
] as const;

export default function Navbar() {
  const { t, lang, setLang } = useLanguage();
  const cfg = useClinicConfig();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label={t("nav.home")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 font-display text-lg font-bold text-teal-300">
            +
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold text-navy-900">{cfg.doctor.name}</span>
            <span className="block text-xs text-navy-500">
              {cfg.clinic.name && !cfg.clinic.name.startsWith("[") ? cfg.clinic.name : t("hero.clinicFallback")}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === l.href ? "bg-navy-50 text-navy-900" : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
              }`}
            >
              {t(l.key)}
            </Link>
          ))}
          <Link href="/appointments/lookup" className="rounded-lg px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50">
            {t("nav.lookup")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-lg border border-navy-100 p-0.5 sm:flex" role="group" aria-label={t("nav.language")}>
            {availableLangs().map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  lang === l ? "bg-teal-600 text-white" : "text-navy-600 hover:bg-navy-50"
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <Link
            href="/book"
            className="hidden rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-teal-700 sm:inline-flex"
          >
            {t("hero.book")}
          </Link>
          <button
            className="rounded-lg p-2 text-navy-700 hover:bg-navy-50 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t("nav.menu")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-navy-100 bg-white px-4 py-3 md:hidden" aria-label="Mobile">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                pathname === l.href ? "bg-navy-50 text-navy-900" : "text-navy-600"
              }`}
            >
              {t(l.key)}
            </Link>
          ))}
          <Link
            href="/appointments/lookup"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
              pathname === "/appointments/lookup" ? "bg-navy-50 text-navy-900" : "text-navy-600"
            }`}
          >
            {t("nav.lookupLong")}
          </Link>
          <div className="mt-2 flex items-center gap-2">
            {availableLangs().map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  lang === l ? "bg-teal-600 text-white" : "text-navy-600 border border-navy-100"
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
            <Link href="/book" className="ml-auto rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
              {t("hero.book")}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
