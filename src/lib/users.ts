/**
 * User management — CRUD for all roles.
 * Users are stored in SQLite; Google identity is linked via google_sub.
 * Super Admin is provisioned via secure setup (env + server-side only).
 */
import crypto from "crypto";
import { getDb, transaction } from "./db";
import type { User } from "./db";
import { hashPassword } from "./auth";
import { auditLog } from "./audit";

export type UserRole = "super_admin" | "hospital_owner" | "patient" | "staff" | "doctor";
export type UserStatus = "active" | "inactive" | "suspended" | "pending_verification";

export function generateUserId(): string {
  return `usr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

export function getUserById(id: string): User | null {
  return (getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User) || null;
}

export function getUserByEmail(email: string): User | null {
  return (getDb().prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as unknown as User) || null;
}

export function getUserByGoogleSub(sub: string): User | null {
  return (getDb().prepare("SELECT * FROM users WHERE google_sub = ?").get(sub) as unknown as User) || null;
}

export function getUserByMobile(mobile: string): User | null {
  return (getDb().prepare("SELECT * FROM users WHERE mobile = ?").get(mobile) as unknown as User) || null;
}

export function listUsers(filter: { role?: string; hospital_id?: string; status?: string; search?: string; limit?: number; offset?: number } = {}): User[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.role) { clauses.push("role = ?"); params.push(filter.role); }
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  if (filter.search) {
    clauses.push("(name LIKE ? OR email LIKE ? OR mobile LIKE ?)");
    const q = `%${filter.search}%`;
    params.push(q, q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  return getDb().prepare(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params as any[], limit, offset) as unknown as User[];
}

export function countUsers(filter: { role?: string; hospital_id?: string; status?: string } = {}): number {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.role) { clauses.push("role = ?"); params.push(filter.role); }
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (getDb().prepare(`SELECT COUNT(*) as c FROM users ${where}`).get(...params as any[]) as { c: number }).c;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  mobile?: string;
  mobile_verified?: boolean;
  hospital_id?: string | null;
  google_sub?: string | null;
  avatar_url?: string | null;
  password?: string; // plain text, will be hashed
  status?: UserStatus;
}

export function createUser(input: CreateUserInput, actor?: string): User {
  const id = generateUserId();
  const now = new Date().toISOString();
  const passwordHash = input.password ? hashPassword(input.password) : null;

  // Prevent duplicate email
  const existing = getUserByEmail(input.email);
  if (existing) throw new Error("A user with this email already exists.");

  getDb().prepare(`
    INSERT INTO users (id, google_sub, email, email_verified, name, mobile, mobile_verified, role, status, hospital_id, avatar_url, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.google_sub ?? null,
    input.email.toLowerCase().trim(),
    input.google_sub ? 1 : 0,
    input.name.trim(),
    input.mobile ?? null,
    input.mobile_verified ? 1 : 0,
    input.role,
    input.status ?? "active",
    input.hospital_id ?? null,
    input.avatar_url ?? null,
    passwordHash,
    now, now
  );

  auditLog(actor ?? "system", "user.created", "user", id, `role=${input.role} email=${input.email}`);
  return getUserById(id)!;
}

export function updateUser(id: string, updates: Partial<CreateUserInput> & { status?: string }, actor?: string): User {
  const user = getUserById(id);
  if (!user) throw new Error("User not found.");

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name.trim()); }
  if (updates.email !== undefined) { fields.push("email = ?"); values.push(updates.email.toLowerCase().trim()); }
  if (updates.mobile !== undefined) { fields.push("mobile = ?"); values.push(updates.mobile); }
  if (updates.mobile_verified !== undefined) { fields.push("mobile_verified = ?"); values.push(updates.mobile_verified ? 1 : 0); }
  if (updates.role !== undefined) { fields.push("role = ?"); values.push(updates.role); }
  if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
  if (updates.hospital_id !== undefined) { fields.push("hospital_id = ?"); values.push(updates.hospital_id); }
  if (updates.avatar_url !== undefined) { fields.push("avatar_url = ?"); values.push(updates.avatar_url); }
  if (updates.password) { fields.push("password_hash = ?"); values.push(hashPassword(updates.password)); }

  if (fields.length === 0) return user;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  getDb().prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...(values as any[]));
  if (actor) auditLog(actor, "user.updated", "user", id, JSON.stringify(updates));
  return getUserById(id)!;
}

export function deleteUser(id: string, actor?: string): void {
  const user = getUserById(id);
  if (!user) throw new Error("User not found.");
  // Soft-delete: set inactive
  getDb().prepare(`UPDATE users SET status = 'inactive', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
  if (actor) auditLog(actor, "user.deactivated", "user", id);
}

export function linkGoogleAccount(userId: string, googleSub: string, email: string, avatarUrl?: string): User {
  const user = getUserById(userId);
  if (!user) throw new Error("User not found.");
  getDb().prepare(`UPDATE users SET google_sub = ?, email_verified = 1, avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?`)
    .run(googleSub, avatarUrl ?? null, new Date().toISOString(), userId);
  return getUserById(userId)!;
}

/**
 * Find or create a user from Google OAuth.
 * Prevents duplicate accounts by checking google_sub first, then email.
 */
export function findOrCreateGoogleUser(profile: { sub: string; email: string; name: string; picture?: string; email_verified?: boolean }): User {
  // 1. Try google_sub
  let user = getUserByGoogleSub(profile.sub);
  if (user) {
    // Update last login
    getDb().prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`).run(new Date().toISOString(), new Date().toISOString(), user.id);
    return getUserById(user.id)!;
  }
  // 2. Try email — link existing account
  user = getUserByEmail(profile.email);
  if (user) {
    getDb().prepare(`UPDATE users SET google_sub = ?, email_verified = ?, avatar_url = COALESCE(?, avatar_url), last_login_at = ?, updated_at = ? WHERE id = ?`)
      .run(profile.sub, profile.email_verified ? 1 : 0, profile.picture ?? null, new Date().toISOString(), new Date().toISOString(), user.id);
    return getUserById(user.id)!;
  }
  // 3. Create new patient
  return createUser({
    email: profile.email,
    name: profile.name,
    role: "patient",
    google_sub: profile.sub,
    avatar_url: profile.picture ?? null,
    status: "pending_verification",
  });
}

export function ensureSuperAdmin(email: string, name: string = "Super Admin", password?: string): User {
  let user = getUserByEmail(email);
  if (user) {
    // Promote to super_admin if not already
    if (user.role !== "super_admin") {
      getDb().prepare(`UPDATE users SET role = 'super_admin', status = 'active', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), user.id);
    }
    return getUserById(user.id)!;
  }
  return createUser({
    email,
    name,
    role: "super_admin",
    password,
    status: "active",
  });
}

export function verifyUserMobile(userId: string, mobile: string): User {
  getDb().prepare(`UPDATE users SET mobile = ?, mobile_verified = 1, status = 'active', updated_at = ? WHERE id = ?`)
    .run(mobile, new Date().toISOString(), userId);
  return getUserById(userId)!;
}


/** Find or provision a patient after successful phone-only OTP authentication. */
export function findOrCreatePhoneUser(mobile: string, name: string): User {
  let user = getUserByMobile(mobile);
  if (user) {
    if (user.role !== "patient") {
      throw new Error("Staff accounts must sign in with Google or the admin portal.");
    }
    const now = new Date().toISOString();
    getDb().prepare(`UPDATE users SET mobile_verified = 1, status = 'active', name = CASE WHEN name = '' THEN ? ELSE name END,
      last_login_at = ?, updated_at = ? WHERE id = ?`).run(name, now, now, user.id);
    return getUserById(user.id)!;
  }
  const safeName = name.trim().replace(/[<>"']/g, "").slice(0, 120);
  const now = new Date().toISOString();
  const created = createUser({
    email: `phone-${mobile}@mobile.local`,
    name: safeName || `Patient ${mobile.slice(-4)}`,
    role: "patient",
    mobile,
    mobile_verified: true,
    status: "active",
  });
  getDb().prepare("UPDATE users SET consent_given = 1, consent_at = ?, last_login_at = ? WHERE id = ?").run(now, now, created.id);
  return getUserById(created.id)!;
}

export function recordAnalyticsConsent(userId: string): void {
  const now = new Date().toISOString();
  getDb().prepare("UPDATE users SET consent_given = 1, consent_at = ?, updated_at = ? WHERE id = ?").run(now, now, userId);
}
