/**
 * Signed-cookie session helpers using the Web Crypto API —
 * works in both the Edge runtime (middleware) and Node.
 * Extended to support user sessions with roles.
 */
export const SESSION_COOKIE = "drxyz_admin_session";
export const USER_SESSION_COOKIE = "hospital_session";

export interface AdminSession {
  admin?: { username: string; loginAt: string };
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    hospital_id: string | null;
    avatar_url: string | null;
    mobile_verified?: boolean;
    consent_given?: boolean;
    loginAt: string;
  };
}

function secret(): string {
  return process.env.SESSION_PASSWORD || "dev-only-change-me-please-0123456789abcdef";
}

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
}

async function hmacHex(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionValue(username: string): Promise<string> {
  const payload = toBase64Url(JSON.stringify({ admin: { username, loginAt: new Date().toISOString() } }));
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

export async function createSessionCookie(username: string): Promise<string> {
  const maxAge = 60 * 60 * 24; // 24h
  const value = await createSessionValue(username);
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function verifySessionValue(value: string | undefined): Promise<AdminSession | null> {
  if (!value) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const [payload, sig] = decoded.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacHex(payload);
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(fromBase64Url(payload)) as AdminSession;
  } catch {
    return null;
  }
}

// ---- User session helpers ----

export async function createUserSessionValue(user: { id: string; email: string; name: string; role: string; hospital_id: string | null; avatar_url?: string | null; mobile_verified?: boolean; consent_given?: boolean }): Promise<string> {
  const payload = toBase64Url(JSON.stringify({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hospital_id: user.hospital_id,
      avatar_url: user.avatar_url ?? null,
      mobile_verified: !!user.mobile_verified,
      consent_given: !!user.consent_given,
      loginAt: new Date().toISOString(),
    }
  }));
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

export async function createUserSessionCookie(user: { id: string; email: string; name: string; role: string; hospital_id: string | null; avatar_url?: string | null; mobile_verified?: boolean; consent_given?: boolean }): Promise<string> {
  const maxAge = 60 * 60 * 24 * 7; // 7 days for regular users
  const value = await createUserSessionValue(user);
  // Set both cookies for compatibility
  return `${USER_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearUserSessionCookie(): string {
  return `${USER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function verifyUserSessionValue(value: string | undefined): Promise<AdminSession | null> {
  return verifySessionValue(value);
}

/** Verify either admin or user session cookie */
export async function verifyAnySession(adminCookie: string | undefined, userCookie: string | undefined): Promise<AdminSession | null> {
  // Try admin first
  let session = await verifySessionValue(adminCookie);
  if (session) return session;
  // Try user session
  session = await verifySessionValue(userCookie);
  return session;
}

export function getSessionRole(session: AdminSession | null): string | null {
  if (!session) return null;
  if (session.user) return session.user.role;
  if (session.admin) return "super_admin"; // legacy admin is super_admin
  return null;
}

export function getSessionUserId(session: AdminSession | null): string | null {
  return session?.user?.id ?? null;
}

export function getSessionHospitalId(session: AdminSession | null): string | null {
  return session?.user?.hospital_id ?? null;
}
