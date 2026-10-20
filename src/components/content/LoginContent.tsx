"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const next = searchParams.get("next") || "/dashboard";
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/auth/google?next=${encodeURIComponent(next)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.authUrl) { setGoogleUrl(data.authUrl); setGoogleConfigured(true); }
        else { setGoogleConfigured(false); setGoogleError(data.error || "Google OAuth not configured."); }
      })
      .catch(() => { setGoogleConfigured(false); setGoogleError("Failed to load auth config."); });
  }, [next]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-soft">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-xl font-bold text-teal-300">+</div>
            <h1 className="mt-4 font-display text-2xl font-semibold text-navy-900">Welcome back</h1>
            <p className="mt-1 text-sm text-navy-500">Sign in to manage appointments, view records & more</p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <div className="mt-8 space-y-4">
            {/* Google Sign-In */}
            {googleConfigured === null ? (
              <div className="flex items-center justify-center rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy-400">
                Loading sign-in options…
              </div>
            ) : googleUrl ? (
              <a
                href={googleUrl}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-navy-200 bg-white px-4 py-3.5 text-sm font-semibold text-navy-700 shadow-sm transition-colors hover:bg-navy-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 015.48 12c0-.72.13-1.43.36-2.09V7.07H2.18A11 11 0 001 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </a>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">Google Sign-In not configured</p>
                <p className="mt-1 text-xs text-amber-700">{googleError}</p>
                <p className="mt-2 text-xs text-amber-600">Administrator: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your environment. See setup docs.</p>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-navy-100" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-navy-400">or</span></div>
            </div>

            <div className="rounded-xl border border-navy-100 bg-navy-50 p-4 text-center">
              <p className="text-sm text-navy-600">Clinic staff?</p>
              <a href="/admin/login" className="mt-1 inline-block text-sm font-semibold text-teal-700 hover:underline">
                Admin login →
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-navy-400">
            By signing in, you agree to our{" "}
            <a href="/privacy" className="underline hover:text-navy-600">Privacy Policy</a>
            {" "}and{" "}
            <a href="/terms" className="underline hover:text-navy-600">Terms</a>.
            <br />Your mobile number will be requested for appointment notifications.
          </p>
        </div>
      </div>
    </div>
  );
}
