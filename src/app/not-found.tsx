"use client";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

export default function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl font-semibold text-navy-200">404</p>
      <h1 className="font-display mt-4 text-3xl font-semibold text-navy-900">{t("nf.title")}</h1>
      <p className="mt-3 text-navy-600">{t("nf.desc")}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/"><Button>{t("nf.home")}</Button></Link>
        <Link href="/book"><Button variant="secondary">{t("nf.book")}</Button></Link>
      </div>
    </div>
  );
}
