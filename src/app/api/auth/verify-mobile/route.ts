import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-guard";
import { consumeOtpRequestLimit, createOtpRecord, verifyOtp } from "@/lib/auth";
import { verifyUserMobile } from "@/lib/users";
import { getDb, initDb } from "@/lib/db";
import { integrationStatus } from "@/lib/config";
import { auditLog } from "@/lib/audit";
import { createUserSessionCookie } from "@/lib/session";
import { recordAnalyticsConsent } from "@/lib/users";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Request OTP for mobile verification
export async function POST(req: NextRequest) {
  initDb();
  const body = await req.json().catch(() => ({}));
  if (body.consent !== true) {
    return NextResponse.json({ error: "Please accept the visitor analytics and privacy notice to continue." }, { status: 400 });
  }

  // Authenticated flow — user is logged in via Google
  if (body.action === "send_otp") {
    const ctx = await getAuthContext(req);
    if (!ctx.session) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const mobile = String(body.mobile ?? "").trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
    }

    const smsStatus = integrationStatus("sms");
    if (String(process.env.NODE_ENV) === "production" && smsStatus !== "live") {
      return NextResponse.json({ error: "Mobile verification is temporarily unavailable. Please try again later." }, { status: 503 });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
    const ipKey = crypto.createHash("sha256").update(`${process.env.SESSION_PASSWORD ?? "rate-limit"}:${ip}`).digest("hex");
    if (!consumeOtpRequestLimit(`otp-phone:${mobile}`, 3, 10) || !consumeOtpRequestLimit(`otp-ip:${ipKey}`, 10, 10)) {
      return NextResponse.json({ error: "Too many OTP requests. Please wait 10 minutes and try again." }, { status: 429 });
    }

    const identifier = `mobile_${mobile}`;
    const { otp, id } = createOtpRecord(identifier, "mobile_verify", 10);
    if (smsStatus === "live") {
      try {
        const { smsProvider } = await import("@/lib/notifications");
        const sms = smsProvider();
        if (!sms) throw new Error("SMS provider unavailable");
        const sent = await sms.send(mobile, `Your verification code for City Care Hospital is ${otp}. Valid for 10 minutes. Do not share this code.`);
        if (!sent.ok) throw new Error(sent.error || "SMS provider rejected the message");
      } catch (e) {
        console.error("[otp] SMS send failed:", e);
        getDb().prepare("DELETE FROM otp_verifications WHERE id = ?").run(id);
        return NextResponse.json({ error: "Could not send the OTP. Please try again later." }, { status: 502 });
      }
    } else {
      // Development/demo mode only — the OTP is never returned in production.
      console.log(`[OTP DEMO] Mobile ${mobile} verification code: ${otp} (id: ${id})`);
    }

    return NextResponse.json({
      ok: true,
      message: smsStatus === "live" ? "OTP sent to your mobile." : "OTP generated. Check server logs in demo mode.",
      // In demo/development, return OTP for testing (never in production with live SMS)
      ...(process.env.NODE_ENV !== "production" ? { demo_otp: otp } : {}),
    });
  }

  if (body.action === "verify_otp") {
    const ctx = await getAuthContext(req);
    if (!ctx.session) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const mobile = String(body.mobile ?? "").trim();
    const otp = String(body.otp ?? "").trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json({ error: "Invalid mobile number." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Enter a valid 6-digit OTP." }, { status: 400 });
    }

    const result = verifyOtp(`mobile_${mobile}`, otp, "mobile_verify");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Mark mobile as verified
    const userId = ctx.user?.id ?? ctx.session.user?.id;
    let sessionCookie: string | null = null;
    if (userId) {
      const user = verifyUserMobile(userId, mobile);
      recordAnalyticsConsent(userId);
      auditLog(ctx.user?.email ?? "unknown", "mobile.verified", "user", userId, `mobile=${mobile}`);
      sessionCookie = await createUserSessionCookie({
        id: user.id, email: user.email, name: user.name, role: user.role,
        hospital_id: user.hospital_id, avatar_url: user.avatar_url,
        mobile_verified: !!user.mobile_verified,
        consent_given: true,
      });
    }

    const response = NextResponse.json({ ok: true, message: "Mobile number verified successfully." });
    if (sessionCookie) response.headers.set("Set-Cookie", sessionCookie);
    return response;
  }

  return NextResponse.json({ error: "Invalid action. Use send_otp or verify_otp." }, { status: 400 });
}
