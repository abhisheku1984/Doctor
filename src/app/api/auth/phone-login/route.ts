import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { initDb, getDb } from "@/lib/db";
import { consumeOtpRequestLimit, createOtpRecord, verifyOtp } from "@/lib/auth";
import { integrationStatus, getConfig } from "@/lib/config";
import { createUserSessionCookie } from "@/lib/session";
import { findOrCreatePhoneUser, recordAnalyticsConsent } from "@/lib/users";
import { trackEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/";
}

export async function POST(req: NextRequest) {
  initDb();
  const body = await req.json().catch(() => ({}));
  const mobile = String(body.mobile ?? "").replace(/\D/g, "").slice(-10);
  const name = String(body.name ?? "").trim().replace(/[<>"']/g, "").slice(0, 120);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Please agree to the visitor analytics and privacy notice to continue." }, { status: 400 });
  }

  if (body.action === "send_otp") {
    if (name.length < 2) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    const smsStatus = integrationStatus("sms");
    if (String(process.env.NODE_ENV) === "production" && smsStatus !== "live") {
      return NextResponse.json({ error: "Phone sign-in is temporarily unavailable. Please try again later." }, { status: 503 });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
    const ipKey = crypto.createHash("sha256").update(`${process.env.SESSION_PASSWORD ?? "rate-limit"}:${ip}`).digest("hex");
    if (!consumeOtpRequestLimit(`otp-phone:${mobile}`, 3, 10) || !consumeOtpRequestLimit(`otp-ip:${ipKey}`, 10, 10)) {
      return NextResponse.json({ error: "Too many OTP requests. Please wait 10 minutes and try again." }, { status: 429 });
    }

    const identifier = `phone_login_${mobile}`;
    const { otp, id } = createOtpRecord(identifier, "login", 10);
    if (smsStatus === "live") {
      try {
        const { smsProvider } = await import("@/lib/notifications");
        const sms = smsProvider();
        if (!sms) throw new Error("SMS provider unavailable");
        const clinic = getConfig().clinic.name;
        const sent = await sms.send(mobile, `Your ${clinic} sign-in code is ${otp}. Valid for 10 minutes. Do not share this code.`);
        if (!sent.ok) throw new Error(sent.error || "SMS provider rejected the message");
      } catch (error) {
        console.error("[phone-login] SMS send failed:", error);
        getDb().prepare("DELETE FROM otp_verifications WHERE id = ?").run(id);
        return NextResponse.json({ error: "Could not send the OTP. Please try again later." }, { status: 502 });
      }
    } else {
      console.log(`[OTP DEMO] Phone login ${mobile}: ${otp} (id: ${id})`);
    }
    return NextResponse.json({
      ok: true,
      message: smsStatus === "live" ? "OTP sent to your mobile." : "Demo OTP generated. Check the development server console.",
      ...(process.env.NODE_ENV !== "production" ? { demo_otp: otp } : {}),
    });
  }

  if (body.action === "verify_otp") {
    const otp = String(body.otp ?? "").trim();
    if (!/^\d{6}$/.test(otp)) return NextResponse.json({ error: "Enter a valid 6-digit OTP." }, { status: 400 });
    const result = verifyOtp(`phone_login_${mobile}`, otp, "login");
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    try {
      const user = findOrCreatePhoneUser(mobile, name);
      recordAnalyticsConsent(user.id);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? null;
      trackEvent({ event_type: "login_success", page: "/phone-login", user_id: user.id, outcome: "success", ip, user_agent: req.headers.get("user-agent") });
      const response = NextResponse.json({ ok: true, next: safeNext(body.next) });
      response.headers.set("Set-Cookie", await createUserSessionCookie({
        id: user.id, email: user.email, name: user.name, role: user.role,
        hospital_id: user.hospital_id, avatar_url: user.avatar_url,
        mobile_verified: true,
        consent_given: true,
      }));
      return response;
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
