"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Button } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";

interface IntegrationData {
  status: Record<string, string>;
  demoMode: boolean;
  avatar: { provider: string; voice: boolean; lipSync: boolean; animation: boolean; note: string };
  requirements: Record<string, string[]>;
}

export default function IntegrationsPage() {
  const { t, lang } = useLanguage();
  const [data, setData] = useState<IntegrationData | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/integrations")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  async function test(target: string) {
    setTesting(target);
    const res = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const r = await res.json();
    setTestResults((t2) => ({ ...t2, [target]: r.message ?? r.error }));
    setTesting(null);
  }

  async function createSpreadsheet() {
    const res = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "sheets-create" }),
    });
    const r = await res.json();
    setTestResults((t2) => ({ ...t2, ["sheets-create"]: r.message }));
  }

  if (!data) return <p className="text-navy-500">{t("integ.loading")}</p>;

  const items: Array<{ key: string; nameKey: TranslationKey; descKey: TranslationKey; testTarget: string }> = [
    { key: "calendar", nameKey: "integ.calendarName", descKey: "integ.calendarDesc", testTarget: "calendar" },
    { key: "sheets", nameKey: "integ.sheetsName", descKey: "integ.sheetsDesc", testTarget: "sheets" },
    { key: "email", nameKey: "integ.emailName", descKey: "integ.emailDesc", testTarget: "email" },
    { key: "sms", nameKey: "integ.smsName", descKey: "integ.smsDesc", testTarget: "sms" },
    { key: "avatar", nameKey: "integ.avatarName", descKey: "integ.avatarDesc", testTarget: "avatar" },
    { key: "onlineConsult", nameKey: "integ.onlineName", descKey: "integ.onlineDesc", testTarget: "calendar" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-navy-900">{t("integ.title")}</h1>
        <Badge tone={data.demoMode ? "amber" : "green"}>{data.demoMode ? t("integ.demoMode") : t("integ.liveMode")}</Badge>
      </div>

      {data.demoMode && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>{t("integ.demoMode")}:</strong> {t("integ.demoNotice")}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => {
          const st = data.status[item.key];
          const reqs = data.requirements[item.key] ?? [];
          return (
            <Card key={item.key} className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-navy-900">{t(item.nameKey)}</h2>
                <Badge tone={st === "live" ? "green" : st === "disabled" ? "gray" : "amber"}>
                  {st === "live" ? t("integ.live") : st === "disabled" ? t("integ.disabled") : t("integ.demo")}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{t(item.descKey)}</p>
              {item.key === "avatar" && (
                <p className="mt-2 rounded-lg bg-navy-50 p-3 text-xs text-navy-600">
                  {t("integ.avatarActive", {
                    provider: data.avatar.provider,
                    voice: data.avatar.voice ? t("integ.on") : t("integ.off"),
                    lip: data.avatar.lipSync ? t("integ.on") : t("integ.approximated"),
                  })}{" "}
                  — {data.avatar.note}
                </p>
              )}
              <p className="mt-3 text-xs text-navy-500">
                <strong>{t("integ.envVars")}</strong> {reqs.join(", ")}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => void test(item.testTarget)} disabled={testing !== null}>
                  {testing === item.key ? t("integ.testing") : t("integ.test")}
                </Button>
                {item.key === "sheets" && (
                  <Button variant="ghost" onClick={() => void createSpreadsheet()}>
                    {t("integ.createSheet")}
                  </Button>
                )}
              </div>
              {testResults[item.key] && <p className="mt-2 rounded-lg bg-navy-50 p-2 text-xs text-navy-700" role="status">{testResults[item.key]}</p>}
            </Card>
          );
        })}
      </div>

      {testResults["sheets-create"] && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900" role="status">
          {testResults["sheets-create"]}
        </div>
      )}
    </div>
  );
}
