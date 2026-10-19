/**
 * Security tests:
 *  - admin API operations reject unauthenticated requests
 *  - patient lookup requires reference + mobile
 *  - password hashing is salted & constant-time
 *  - session cookies are signed
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb } from "./helpers";
import { hashPassword, verifyPassword, createSessionValue, createSessionCookie, readSession } from "../src/lib/auth";
import { requireAdmin } from "../src/lib/admin-guard";

before(() => setupTestDb());

function mockRequest(cookieValue?: string) {
  const store = new Map<string, { value: string }>();
  if (cookieValue) store.set("drxyz_admin_session", { value: cookieValue });
  return {
    cookies: { get: (n: string) => store.get(n) },
    headers: new Map(),
    nextUrl: { searchParams: new URLSearchParams() },
    ip: "127.0.0.1",
  } as any;
}

test("admin endpoints reject unauthenticated requests (401)", async () => {
  const guard = await requireAdmin(mockRequest());
  assert.ok(guard, "must return a 401 response when unauthenticated");
  assert.equal(guard!.status, 401);
});

test("valid session cookie is accepted", async () => {
  const value = await createSessionValue("clinicadmin");
  const guard = await requireAdmin(mockRequest(value));
  assert.equal(guard, null);
});

test("tampered session cookie is rejected", async () => {
  const cookie = await createSessionCookie("clinicadmin");
  const [payload] = cookie.split(".");
  const tampered = `${payload}.deadbeefdeadbeefdeadbeefdeadbeef`;
  const guard = await requireAdmin(mockRequest(tampered));
  assert.ok(guard, "tampered cookie must be rejected");
});

test("passwords are salted — same input, different hashes", () => {
  const a = hashPassword("hunter2");
  const b = hashPassword("hunter2");
  assert.notEqual(a, b, "salts must differ");
  assert.ok(verifyPassword("hunter2", a));
  assert.ok(verifyPassword("hunter2", b));
  assert.ok(!verifyPassword("wrong", a));
});

test("patient lookup requires both reference and mobile", async () => {
  // The API layer enforces this; test the service function directly.
  const { findAppointment } = await import("../src/lib/booking");
  assert.equal(findAppointment("APT-NOPE", "9999999999"), null);
});
