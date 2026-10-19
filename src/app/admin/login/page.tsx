"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, setup: setupMode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("admin.loginFailed")); return; }
      if (setupMode) {
        setSetupMode(false);
        setError(null);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError(t("admin.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-semibold text-navy-900">{t("admin.loginTitle")}</h1>
        <p className="mt-2 text-sm text-navy-500">{t("admin.staffOnly")}</p>

        {setupMode ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label={t("admin.choosePassword")}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </Field>
            <Button type="submit" disabled={busy || password.length < 8}>{t("admin.createLogin")}</Button>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label={t("admin.username")}>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </Field>
            <Field label={t("admin.password")}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </Field>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? t("admin.signingIn") : t("admin.signIn")}</Button>
          </form>
        )}

        {!setupMode && (
          <button onClick={() => setSetupMode(true)} className="mt-4 text-sm text-teal-700 hover:underline">
            {t("admin.firstTime")}
          </button>
        )}
      </Card>
    </div>
  );
}
