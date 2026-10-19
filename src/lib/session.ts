/**
 * Signed-cookie session helpers using the Web Crypto API —
 * works in both the Edge runtime (middleware) and Node.
 */
export const SESSION_COOKIE = "drxyz_admin_session";

export interface AdminSession {
  admin?: { username: string; loginAt: string };
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
