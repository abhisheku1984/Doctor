/**
 * Authentication — supports:
 * - Admin password auth (legacy, for single-clinic Super Admin bootstrap)
 * - User DB auth (password-based for Hospital Owner / Staff)
 * - Google OAuth (patient + all roles)
 * - Role-based access control (RBAC)
 */
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  createSessionCookie,
  clearSessionCookie,
  createSessionValue,
  verifySessionValue,
  type AdminSession,
} from "./session";
import { getDb, transaction } from "./db";
import { auditLog } from "./audit";

export { createSessionCookie, clearSessionCookie, createSessionValue, verifySessionValue };
export type { AdminSession };

// Re-export new user auth
export * from "./users";
export * from "./rbac";

export function hashPassword(plain: string, salt = crypto.randomBytes(16).toString("hex")): string {
  const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [method, salt, hash] = stored.split(":");
  if (method !== "scrypt" || !salt || !hash) return false;
  const test = crypto.scryptSync(plain, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(test));
}

export function getAdminPasswordHash(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD_HASH;
  if (fromEnv) return fromEnv;
  const row = getDb().prepare("SELECT value FROM kv WHERE key = 'admin_password_hash'").get() as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || "clinicadmin";
}

export function getSuperAdminEmail(): string | null {
  return process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || null;
}

export function setAdminPassword(plain: string): void {
  getDb()
    .prepare(`INSERT INTO kv (key, value) VALUES ('admin_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(hashPassword(plain));
}

/** In-memory login attempt limiter (per-IP, sliding window). */
const attempts = new Map<string, { count: number; resetAt: number }>();
export function checkRateLimit(ip: string, limit = 10, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  rec.count++;
  return rec.count <= limit;
}

export function recordLogin(username: string, ok: boolean): void {
  auditLog(username, ok ? "admin.login" : "admin.login_failed", "session", null);
}

export async function readSession(req: NextRequest): Promise<AdminSession | null> {
  return verifySessionValue(req.cookies.get("drxyz_admin_session")?.value);
}

// --- OTP helpers ---

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function generateOtp(length = 6): string {
  let otp = "";
  for (let i = 0; i < length; i++) otp += crypto.randomInt(0, 10).toString();
  return otp;
}


/** Atomic persistent rate limit for OTP sends. */
export function consumeOtpRequestLimit(identifier: string, maxRequests = 3, windowMinutes = 10): boolean {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const windowMs = windowMinutes * 60 * 1000;
  return transaction(() => {
    db.prepare("DELETE FROM otp_request_limits WHERE window_started_at < ?").run(new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString());
    const row = db.prepare("SELECT window_started_at, request_count FROM otp_request_limits WHERE identifier = ?").get(identifier) as
      | { window_started_at: string; request_count: number }
      | undefined;
    if (!row || now.getTime() - new Date(row.window_started_at).getTime() >= windowMs) {
      db.prepare(`INSERT INTO otp_request_limits (identifier, window_started_at, request_count) VALUES (?, ?, 1)
        ON CONFLICT(identifier) DO UPDATE SET window_started_at = excluded.window_started_at, request_count = 1`).run(identifier, nowIso);
      return true;
    }
    if (row.request_count >= maxRequests) return false;
    db.prepare("UPDATE otp_request_limits SET request_count = request_count + 1 WHERE identifier = ?").run(identifier);
    return true;
  });
}

export function createOtpRecord(identifier: string, purpose: string = "mobile_verify", ttlMinutes: number = 10): { id: string; otp: string } {
  const otp = generateOtp();
  const id = `otp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  getDb()
    .prepare(`INSERT INTO otp_verifications (id, identifier, otp_hash, purpose, max_attempts, expires_at, created_at) VALUES (?, ?, ?, ?, 5, ?, ?)`)
    .run(id, identifier, hashOtp(otp), purpose, expiresAt, new Date().toISOString());
  return { id, otp };
}

export function verifyOtp(identifier: string, otp: string, purpose: string = "mobile_verify"): { ok: boolean; error?: string } {
  const row = getDb().prepare(`SELECT * FROM otp_verifications WHERE identifier = ? AND purpose = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1`).get(identifier, purpose) as
    | { id: string; otp_hash: string; attempts: number; max_attempts: number; expires_at: string }
    | undefined;
  if (!row) return { ok: false, error: "No OTP found. Please request a new one." };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "OTP expired. Please request a new one." };
  if (row.attempts >= row.max_attempts) return { ok: false, error: "Too many attempts. Please request a new OTP." };

  getDb().prepare(`UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`).run(row.id);

  if (hashOtp(otp) !== row.otp_hash) return { ok: false, error: "Invalid OTP." };

  getDb().prepare(`UPDATE otp_verifications SET verified = 1 WHERE id = ?`).run(row.id);
  return { ok: true };
}
