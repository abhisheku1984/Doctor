"use client";
import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

interface Summary {
  reference: string;
  doctor: string;
  mode: string;
  modeLabel: string;
  date: string;
  time: string;
  service: string;
  fee: string;
  onlineLink: string | null;
}

export default function ConfirmationContent({
  state,
  summary,
  durationMin,
  clinicAddress,
  cancellationPolicyHours,
}: {
  state: "no-ref" | "not-found" | "ok";
  summary: Summary | null;
  durationMin: number;
  clinicAddress: string;
  cancellationPolicyHours: number;
}) {
  const { t } = useLanguage();

  if (state === "no-ref") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy-900">{t("confirm.noRef")}</h1>
        <p className="mt-3 text-navy-600">{t("confirm.noRefDesc")}</p>
        <Link href="/book" className="mt-6 inline-block"><Button>{t("confirm.bookBtn")}</Button></Link>
      </div>
    );
  }

  if (state === "not-found" || !summary) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy-900">{t("confirm.notFound")}</h1>
        <p className="mt-3 text-navy-600">{t("confirm.notFoundDesc")}</p>
        <Link href="/appointments/lookup" className="mt-6 inline-block"><Button>{t("confirm.lookupBtn")}</Button></Link>
      </div>
    );
  }

  const s = summary;
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Card className="p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy-900">{t("confirm.title")}</h1>
            <p className="text-sm text-navy-500">{t("confirm.sent")}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-navy-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">{t("confirm.refLabel")}</p>
          <p className="font-display text-2xl font-semibold tracking-wide text-navy-900">{s.reference}</p>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <Row k={t("row.doctor")} v={s.doctor} />
          <Row k={t("row.consultation")} v={s.modeLabel} />
          <Row k={t("row.service")} v={s.service} />
          <Row k={t("row.date")} v={s.date} />
          <Row k={t("row.time")} v={`${s.time} (${t("common.min", { count: durationMin })})`} />
          <Row k={t("row.fee")} v={s.fee} />
          {s.onlineLink && <Row k={t("row.join")} v={s.onlineLink} link />}
        </dl>

        {s.mode === "online" && !s.onlineLink && (
          <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
            {t("confirm.onlineNote")}
          </p>
        )}
        {s.mode === "in_person" && (
          <p className="mt-4 rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
            {clinicAddress
              ? t("confirm.venue", { address: clinicAddress })
              : t("confirm.venueTBP")}
          </p>
        )}

        <div className="mt-6 rounded-xl border border-navy-100 p-4 text-sm text-navy-600">
          <strong className="text-navy-900">{t("confirm.changeTitle")}</strong>{" "}
          {t("confirm.changeBody", {
            hours: cancellationPolicyHours,
            link: t("confirm.lookupLink"),
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/"><Button variant="secondary">{t("confirm.backHome")}</Button></Link>
          <Link href="/appointments/lookup"><Button>{t("confirm.manage")}</Button></Link>
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v, link }: { k: string; v: string; link?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-100 pb-2 last:border-0">
      <dt className="text-navy-500">{k}</dt>
      <dd className={`text-right font-medium ${link ? "break-all text-teal-700" : "text-navy-900"}`}>{v}</dd>
    </div>
  );
}
