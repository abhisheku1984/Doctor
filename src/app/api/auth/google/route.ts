import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google/oauth";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({
      error: "Google OAuth is not configured.",
      hint: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your environment. See docs/GOOGLE_SETUP.md",
      configured: false,
    }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const next = searchParams.get("next") || "/dashboard";
  // Encode next URL in state for callback
  const state = Buffer.from(JSON.stringify({ next, nonce: Math.random().toString(36).slice(2) })).toString("base64url");

  try {
    const url = getGoogleAuthUrl(state);
    return NextResponse.json({ authUrl: url, configured: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, configured: false }, { status: 500 });
  }
}
