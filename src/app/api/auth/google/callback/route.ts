import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { exchangeCodeForTokens, verifyIdToken, getProfileFromAccessToken } from "@/lib/google/oauth";
import { findOrCreateGoogleUser } from "@/lib/users";
import { createUserSessionCookie } from "@/lib/session";
import { initDb } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { recordAnalyticsConsent } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.json({ error: "Missing authorization code." }, { status: 400 });
  }

  const signedState = parseSignedOAuthState(state, req.cookies.get("drxyz_oauth_state")?.value);
  if (!signedState) return NextResponse.redirect(new URL("/login?error=Invalid%20or%20expired%20sign-in%20request", req.url));
  const nextUrl = signedState.next;

  try {
    const tokens = await exchangeCodeForTokens(code);
    let profile;
    if (tokens.id_token) {
      profile = await verifyIdToken(tokens.id_token);
    } else {
      profile = await getProfileFromAccessToken(tokens.access_token);
    }

    const user = findOrCreateGoogleUser({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      email_verified: profile.email_verified,
    });
    if (!signedState.consent) {
      return NextResponse.redirect(new URL("/login?error=Please%20accept%20the%20privacy%20notice%20to%20continue", req.url));
    }
    recordAnalyticsConsent(user.id);

    // Track login
    try {
      trackEvent({
        event_type: "login_success",
        page: "/api/auth/google/callback",
        user_id: user.id,
        outcome: "success",
        ip: req.headers.get("x-forwarded-for") ?? req.ip ?? null,
        user_agent: req.headers.get("user-agent") ?? null,
      });
    } catch { /* ignore */ }

    // If mobile not verified and user is new, redirect to verify page
    let redirectPath = nextUrl;
    if (!user.mobile_verified && user.status === "pending_verification") {
      redirectPath = `/verify-mobile?next=${encodeURIComponent(nextUrl)}`;
    } else if (user.role === "super_admin" || user.role === "hospital_owner") {
      redirectPath = "/admin";
    }

    const res = NextResponse.redirect(new URL(redirectPath, req.url));
    res.headers.append("Set-Cookie", "drxyz_oauth_state=; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=0");
    res.headers.append("Set-Cookie", await createUserSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hospital_id: user.hospital_id,
      avatar_url: user.avatar_url,
      mobile_verified: !!user.mobile_verified,
      consent_given: true,
    }));
    return res;
  } catch (e) {
    console.error("[oauth] callback error:", e);
    try {
      trackEvent({
        event_type: "login_failure",
        page: "/api/auth/google/callback",
        outcome: "failure",
        error_code: (e as Error).message,
      });
    } catch { /* ignore */ }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent((e as Error).message)}`, req.url));
  }
}


function parseSignedOAuthState(state: string | null, cookie: string | undefined): { next: string; consent: boolean } | null {
  if (!state || !cookie) return null;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", process.env.SESSION_PASSWORD || "dev-only-change-me-please-0123456789abcdef").update(payload).digest("base64url");
  const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  if (!safeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.nonce !== cookie || typeof data.consent !== "boolean" || data.consent !== true) return null;
    const next = typeof data.next === "string" && data.next.startsWith("/") && !data.next.startsWith("//") && !data.next.includes("\\") ? data.next : "/";
    return { next, consent: data.consent };
  } catch { return null; }
}
