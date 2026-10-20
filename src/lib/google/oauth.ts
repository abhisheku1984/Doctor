/**
 * Google OAuth (Sign-In) — server-side verification.
 * Uses Google's token verification; never stores passwords.
 * Credentials from env only, never exposed to browser.
 */
import { getDb } from "../db";

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  if (!isGoogleOAuthConfigured()) return null;
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || "http://localhost:3000"}/api/auth/google/callback`,
  };
}

export function getGoogleAuthUrl(state?: string): string {
  const cfg = getGoogleOAuthConfig();
  if (!cfg) throw new Error("Google OAuth is not configured.");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  if (state) params.set("state", state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{ access_token: string; id_token: string }> {
  const cfg = getGoogleOAuthConfig();
  if (!cfg) throw new Error("Google OAuth is not configured.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

export async function verifyIdToken(idToken: string): Promise<GoogleProfile> {
  // Verify via Google's tokeninfo endpoint
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!res.ok) throw new Error("Invalid ID token.");
  const data = await res.json();

  const cfg = getGoogleOAuthConfig();
  if (cfg && data.aud !== cfg.clientId) throw new Error("Token audience mismatch.");

  return {
    sub: data.sub,
    email: data.email,
    email_verified: data.email_verified === "true" || data.email_verified === true,
    name: data.name,
    given_name: data.given_name,
    family_name: data.family_name,
    picture: data.picture,
    locale: data.locale,
  };
}

export async function getProfileFromAccessToken(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user profile.");
  const data = await res.json();
  return {
    sub: data.sub,
    email: data.email,
    email_verified: data.email_verified,
    name: data.name,
    given_name: data.given_name,
    family_name: data.family_name,
    picture: data.picture,
    locale: data.locale,
  };
}
