"use client";
import { useState } from "react";

export default function VerifyMobileContent() {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  const sendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/verify-mobile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_otp", mobile, consent: analyticsConsent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("otp");
      setSuccess(data.message);
      if (data.demo_otp) setDemoOtp(data.demo_otp);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) { setError("Enter a valid 6-digit OTP."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/verify-mobile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", mobile, otp, consent: analyticsConsent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess("Mobile verified! Redirecting…");
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("next") || "/dashboard";
      const next = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/dashboard";
      setTimeout(() => { window.location.href = next; }, 1000);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-8 shadow-soft">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-xl">📱</div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-navy-900">Verify your mobile</h1>
          <p className="mt-1 text-sm text-navy-500">We need your mobile number to send appointment confirmations and reminders.</p>
        </div>

        {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

        {step === "mobile" ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-navy-700">Mobile number</label>
              <div className="mt-1 flex rounded-xl border border-navy-200 overflow-hidden">
                <span className="bg-navy-50 px-3 py-3 text-sm text-navy-600 border-r border-navy-200">+91</span>
                <input
                  type="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="flex-1 px-3 py-3 text-sm outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-navy-400">We&apos;ll send a 6-digit OTP to this number.</p>
            </div>
            <p className="rounded-lg bg-navy-50 p-3 text-xs text-navy-500">
              By providing your mobile number, you consent to receive appointment confirmations, reminders, and updates via SMS. You can update your preferences in your profile.
            </p>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-navy-600">
              <input type="checkbox" checked={analyticsConsent} onChange={(e) => setAnalyticsConsent(e.target.checked)} className="mt-0.5" />
              <span>I agree that my verified account and website visits may be linked for visitor analytics. Read the <a href="/privacy" className="underline">Privacy Policy</a>.</span>
            </label>
            <button
              onClick={sendOtp} disabled={loading || !analyticsConsent}
              className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-navy-600">OTP sent to <span className="font-semibold">+91 {mobile}</span></p>
            {demoOtp && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">Demo Mode — Your OTP is:</p>
                <p className="font-mono text-lg font-bold text-amber-900 tracking-widest">{demoOtp}</p>
                <p className="text-xs text-amber-600">In production, this arrives via SMS.</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-navy-700">Enter OTP</label>
              <input
                type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code" maxLength={6}
                className="mt-1 w-full rounded-xl border border-navy-200 px-4 py-3 text-center text-lg tracking-[0.3em] font-mono outline-none focus:border-teal-500"
              />
              <p className="mt-1 text-xs text-navy-400">OTP expires in 10 minutes.</p>
            </div>
            <button
              onClick={verifyOtp} disabled={loading}
              className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & Continue"}
            </button>
            <button onClick={() => { setStep("mobile"); setError(null); setSuccess(null); }} className="w-full text-sm text-navy-500 hover:text-navy-700">
              Change mobile number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
