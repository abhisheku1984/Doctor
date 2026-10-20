import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, verifyIdToken, getProfileFromAccessToken, getGoogleOAuthConfig } from "@/lib/google/oauth";
import { findOrCreateGoogleUser } from "@/lib/users";
import { createUserSessionCookie } from "@/lib/session";
import { initDb } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

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

  let nextUrl = "/dashboard";
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      if (decoded.next) nextUrl = decoded.next;
    } catch { /* ignore */ }
  }

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
    res.headers.set("Set-Cookie", await createUserSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hospital_id: user.hospital_id,
      avatar_url: user.avatar_url,
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
