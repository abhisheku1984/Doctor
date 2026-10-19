"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { useClinicConfig } from "./ClinicConfigProvider";

const links = [
  { href: "/about", key: "nav.about", label: "About Dr. XYZ" },
  { href: "/services", key: "nav.services", label: "Services" },
  { href: "/book", key: "nav.book", label: "Book an Appointment" },
  { href: "/contact", key: "nav.contact", label: "Contact" },
] as const;

export default function Navbar() {
  const { t, lang, setLang } = useLanguage();
  const cfg = useClinicConfig();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 font-display text-lg font-bold text-teal-300">
            +
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold text-navy-900">{cfg.doctor.name}</span>
            <span className="block text-xs text-navy-500">
              {cfg.clinic.name && !cfg.clinic.name.startsWith("[") ? cfg.clinic.name : "Clinic"}
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
            Look up
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-lg border border-navy-100 p-0.5 sm:flex" role="group" aria-label="Language">
            {(["en", "hi", "te"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${
                  lang === l ? "bg-teal-600 text-white" : "text-navy-600 hover:bg-navy-50"
                }`}
              >
                {l}
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
            aria-label="Toggle menu"
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
            Appointment Lookup
          </Link>
          <div className="mt-2 flex items-center gap-2">
            {(["en", "hi", "te"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${
                  lang === l ? "bg-teal-600 text-white" : "text-navy-600 border border-navy-100"
                }`}
              >
                {l}
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
