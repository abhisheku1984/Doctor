"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function PhoneLoginContent() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<"details" | "otp">("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [demoOtp, setDemoOtp] = useState("");

  const request = async (action: "send_otp" | "verify_otp") => {
    setLoading(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/auth/phone-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, name, mobile, otp, consent: true,
          next: searchParams.get("next") || "/",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed.");
      if (action === "send_otp") {
        setStep("otp"); setMessage(data.message || "OTP sent."); setDemoOtp(data.demo_otp || "");
      } else {
        window.location.href = data.next || "/";
      }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-7 shadow-soft sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-xl">📱</div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-navy-900">Sign in with mobile</h1>
          <p className="mt-2 text-sm text-navy-500">Verify your number with a one-time code to view the hospital website.</p>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}

        {step === "details" ? (
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-navy-700">Your name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} className="mt-1 w-full rounded-xl border border-navy-200 px-3 py-3" placeholder="Full name" />
            </label>
            <label className="block text-sm font-medium text-navy-700">Mobile number
              <span className="mt-1 flex overflow-hidden rounded-xl border border-navy-200"><span className="border-r border-navy-200 bg-navy-50 px-3 py-3 text-navy-500">+91</span><input type="tel" inputMode="numeric" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} className="min-w-0 flex-1 px-3 py-3 outline-none" placeholder="10-digit number" /></span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-navy-600">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>I agree to link my verified account to my website visits for visitor analytics, as explained in the <Link href="/privacy" className="underline">Privacy Policy</Link>. I understand sign-in is required to view the site.</span>
            </label>
            <button onClick={() => void request("send_otp")} disabled={loading || !consent || name.trim().length < 2 || mobile.length !== 10} className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {loading ? "Sending code…" : "Send OTP"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {demoOtp && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center"><p className="text-xs text-amber-800">Development demo code</p><p className="font-mono text-xl font-bold tracking-widest text-amber-900">{demoOtp}</p></div>}
            <label className="block text-sm font-medium text-navy-700">6-digit code
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-1 w-full rounded-xl border border-navy-200 px-3 py-3 text-center font-mono text-xl tracking-[0.3em]" placeholder="••••••" />
            </label>
            <button onClick={() => void request("verify_otp")} disabled={loading || otp.length !== 6} className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{loading ? "Verifying…" : "Verify & continue"}</button>
            <button onClick={() => { setStep("details"); setOtp(""); setDemoOtp(""); setMessage(""); }} className="w-full text-sm text-navy-500 hover:text-navy-800">Change number</button>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-navy-400">Prefer Google? <Link href={`/login?next=${encodeURIComponent(searchParams.get("next") || "/")}`} className="font-semibold text-teal-700 underline">Continue with Google</Link></p>
      </div>
    </div>
  );
}
