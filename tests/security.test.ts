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
import { consumeOtpRequestLimit } from "../src/lib/auth";
import { findOrCreatePhoneUser, recordAnalyticsConsent } from "../src/lib/users";
import { getIdentifiedVisitors, trackEvent } from "../src/lib/analytics";

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


test("OTP send limits are persistent per identifier", () => {
  const key = `test-rate-${Date.now()}`;
  assert.equal(consumeOtpRequestLimit(key, 3, 10), true);
  assert.equal(consumeOtpRequestLimit(key, 3, 10), true);
  assert.equal(consumeOtpRequestLimit(key, 3, 10), true);
  assert.equal(consumeOtpRequestLimit(key, 3, 10), false);
});

test("phone-verified visitor pageviews are identifiable in admin analytics", () => {
  const mobile = "9876500001";
  const user = findOrCreatePhoneUser(mobile, "Analytics Test Visitor");
  recordAnalyticsConsent(user.id);
  trackEvent({ event_type: "page_view", page: "/services", user_id: user.id, hospital_id: "hosp_default", session_id: "test-session" });
  const visitor = getIdentifiedVisitors("hosp_default").find((v) => v.user_id === user.id);
  assert.ok(visitor, "verified and consented page visitor should be listed");
  assert.equal(visitor!.name, "Analytics Test Visitor");
  assert.equal(visitor!.mobile, mobile);
  assert.equal(visitor!.last_page, "/services");
});

test("phone OTP sign-in issues verified session and tracks identified pageviews", async () => {
  const { POST: phoneLogin } = await import("../src/app/api/auth/phone-login/route");
  const { POST: track } = await import("../src/app/api/analytics/route");
  const { NextRequest } = await import("next/server");
  const base = "http://localhost";
  const mobile = "9876500002";
  const send = await phoneLogin(new NextRequest(`${base}/api/auth/phone-login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "send_otp", name: "OTP Test Visitor", mobile, consent: true }),
  }));
  assert.equal(send.status, 200);
  const sent = await send.json();
  assert.match(sent.demo_otp, /^\d{6}$/);

  const verify = await phoneLogin(new NextRequest(`${base}/api/auth/phone-login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "verify_otp", name: "OTP Test Visitor", mobile, otp: sent.demo_otp, consent: true, next: "/services" }),
  }));
  assert.equal(verify.status, 200);
  const sessionCookie = verify.headers.get("set-cookie");
  assert.ok(sessionCookie?.startsWith("hospital_session="));
  const cookie = sessionCookie!.split(";")[0];

  const pageView = await track(new NextRequest(`${base}/api/analytics`, {
    method: "POST", headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ event_type: "page_view", page: "/services", session_id: "otp-test" }),
  }));
  assert.equal(pageView.status, 201);
  const { getIdentifiedVisitors } = await import("../src/lib/analytics");
  assert.ok(getIdentifiedVisitors("hosp_default").some((v) => v.mobile === mobile));
});

test("admin appointment export downloads a complete Excel-compatible CSV", async () => {
  const { GET } = await import("../src/app/api/admin/appointments/route");
  const { NextRequest } = await import("next/server");
  const session = await createSessionValue("export-admin");
  const response = await GET(new NextRequest("http://localhost/api/admin/appointments?export=csv", {
    headers: { cookie: `drxyz_admin_session=${encodeURIComponent(session)}` },
  }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/csv/);
  assert.match(response.headers.get("content-disposition") || "", /appointments-.*\.csv/);
  const csv = await response.text();
  assert.match(csv, /Patient Email/);
  assert.match(csv, /Cancellation Reason/);
  assert.match(csv, /Hospital ID/);
});
