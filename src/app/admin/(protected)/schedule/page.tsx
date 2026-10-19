"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Field, Badge } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
import { translate, type TranslationKey } from "@/lib/i18n";

interface Rule {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
  duration_min: number;
  buffer_min: number;
  active: number;
}

const DAY_KEYS = ["day.0", "day.1", "day.2", "day.3", "day.4", "day.5", "day.6"] as const;

export default function SchedulePage() {
  const { t, lang } = useLanguage();
  const [rules, setRules] = useState<Rule[]>([]);
  const [blocks, setBlocks] = useState<Array<{ id: number; date: string; start_time: string | null; end_time: string | null; reason: string; kind: string }>>([]);
  const [previewDate, setPreviewDate] = useState("");
  const [preview, setPreview] = useState<{ slots: Array<{ time: string; available: boolean }> } | null>(null);
  const [saved, setSaved] = useState(false);

  // new block form
  const [bDate, setBDate] = useState("");
  const [bStart, setBStart] = useState("");
  const [bEnd, setBEnd] = useState("");
  const [bReason, setBReason] = useState("");
  const [bKind, setBKind] = useState("blocked");

  const dayName = (dow: number) => translate(lang, DAY_KEYS[dow] as TranslationKey);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/admin/schedule");
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
      setPreview(data.preview);
    }
    const b = await fetch("/api/admin/blocked");
    if (b.ok) setBlocks((await b.json()).periods);
  }

  async function save() {
    const res = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  function updateRule(dow: number, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r) => (r.day_of_week === dow ? { ...r, ...patch } : r)));
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: bDate, start_time: bStart || null, end_time: bEnd || null, reason: bReason, kind: bKind }),
    });
    setBDate(""); setBStart(""); setBEnd(""); setBReason("");
    void load();
  }

  async function removeBlock(id: number) {
    await fetch(`/api/admin/blocked?id=${id}`, { method: "DELETE" });
    void load();
  }

  async function loadPreview(date: string) {
    setPreviewDate(date);
    const res = await fetch(`/api/admin/schedule?previewDate=${date}`);
    if (res.ok) setPreview((await res.json()).preview);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-navy-900">{t("sched.title")}</h1>
        {saved && <Badge tone="green">{t("sched.saved")}</Badge>}
        <Button onClick={() => void save()}>{t("sched.save")}</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wider text-navy-500">
              <th className="px-4 py-3">{t("sched.day")}</th>
              <th className="px-4 py-3">{t("sched.open")}</th>
              <th className="px-4 py-3">{t("sched.close")}</th>
              <th className="px-4 py-3">{t("sched.breakStart")}</th>
              <th className="px-4 py-3">{t("sched.breakEnd")}</th>
              <th className="px-4 py-3">{t("sched.duration")}</th>
              <th className="px-4 py-3">{t("sched.buffer")}</th>
              <th className="px-4 py-3">{t("sched.active")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rules.map((r) => (
              <tr key={r.day_of_week}>
                <td className="px-4 py-2 font-medium text-navy-800">{dayName(r.day_of_week)}</td>
                {(["open_time", "close_time", "break_start", "break_end"] as const).map((f) => (
                  <td key={f} className="px-4 py-2">
                    <Input type="time" value={r[f] ?? ""} onChange={(e) => updateRule(r.day_of_week, { [f]: e.target.value || null })} className="w-28" />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <Input type="number" min={5} max={120} value={r.duration_min} onChange={(e) => updateRule(r.day_of_week, { duration_min: Number(e.target.value) })} className="w-20" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" min={0} max={60} value={r.buffer_min} onChange={(e) => updateRule(r.day_of_week, { buffer_min: Number(e.target.value) })} className="w-20" />
                </td>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={!!r.active} onChange={(e) => updateRule(r.day_of_week, { active: e.target.checked ? 1 : 0 })} aria-label={`${dayName(r.day_of_week)} ${t("sched.active")}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold text-navy-900">{t("sched.blocksTitle")}</h2>
          <form onSubmit={addBlock} className="mt-4 space-y-3">
            <Field label={t("sched.date")}>
              <Input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("sched.startAllDay")}><Input type="time" value={bStart} onChange={(e) => setBStart(e.target.value)} /></Field>
              <Field label={t("sched.end")}><Input type="time" value={bEnd} onChange={(e) => setBEnd(e.target.value)} /></Field>
            </div>
            <Field label={t("sched.reason")}><Input value={bReason} onChange={(e) => setBReason(e.target.value)} required placeholder={t("sched.reasonPh")} /></Field>
            <Field label={t("sched.type")}>
              <select className="w-full rounded-xl border border-navy-200 px-4 py-3 text-sm" value={bKind} onChange={(e) => setBKind(e.target.value)}>
                <option value="blocked">{t("sched.blocked")}</option>
                <option value="holiday">{t("sched.holiday")}</option>
                <option value="leave">{t("sched.leave")}</option>
              </select>
            </Field>
            <Button type="submit">{t("sched.add")}</Button>
          </form>

          <ul className="mt-5 space-y-2">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2 text-sm">
                <span>
                  <strong>{b.date}</strong> {b.start_time ? `${b.start_time}–${b.end_time}` : t("sched.allDay")} — {b.reason}
                  <span className="ml-2 text-xs text-navy-400">({b.kind})</span>
                </span>
                <Button variant="ghost" onClick={() => void removeBlock(b.id)} aria-label={t("sched.removeBlock", { date: b.date })}>✕</Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold text-navy-900">{t("sched.previewTitle")}</h2>
          <form onSubmit={(e) => { e.preventDefault(); void loadPreview(previewDate); }} className="mt-4 flex gap-2">
            <Input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} required />
            <Button type="submit">{t("sched.preview")}</Button>
          </form>
          {preview && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {preview.slots.map((s) => (
                <span key={s.time} className={`rounded-lg px-2 py-1.5 text-center text-xs font-medium ${s.available ? "bg-teal-50 text-teal-700" : "bg-navy-50 text-navy-300 line-through"}`}>
                  {s.time}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
