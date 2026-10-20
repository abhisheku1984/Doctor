import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google/oauth";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";
const STATE_COOKIE = "drxyz_oauth_state";
const stateSecret = () => process.env.SESSION_PASSWORD || "dev-only-change-me-please-0123456789abcdef";

export async function GET(req: NextRequest) {
  initDb();
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured.", configured: false }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  if (searchParams.get("check") === "1") return NextResponse.json({ configured: true });
  if (searchParams.get("consent") !== "1") {
    return NextResponse.json({ error: "Please accept the privacy notice before signing in." }, { status: 400 });
  }

  const requestedNext = searchParams.get("next") || "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/";
  const nonce = crypto.randomBytes(24).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ next, nonce, consent: true, issuedAt: Date.now() })).toString("base64url");
  const signature = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const state = `${payload}.${signature}`;
  try {
    const authUrl = getGoogleAuthUrl(state);
    const response = NextResponse.json({ authUrl, configured: true });
    response.cookies.set(STATE_COOKIE, nonce, {
      httpOnly: true, secure: String(process.env.NODE_ENV) === "production", sameSite: "lax",
      path: "/api/auth/google/callback", maxAge: 10 * 60,
    });
    return response;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, configured: false }, { status: 500 });
  }
}
