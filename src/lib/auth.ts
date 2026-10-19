/**
 * Admin authentication — scrypt password hashing (Node) +
 * signed-cookie sessions (Web Crypto, edge-safe).
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
import { getDb } from "./db";
import { auditLog } from "./audit";

export { createSessionCookie, clearSessionCookie, createSessionValue, verifySessionValue };
export type { AdminSession };

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
