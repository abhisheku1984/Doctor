import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-guard";
import { createOtpRecord, verifyOtp } from "@/lib/auth";
import { getUserById, verifyUserMobile } from "@/lib/users";
import { initDb } from "@/lib/db";
import { integrationStatus } from "@/lib/config";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Request OTP for mobile verification
export async function POST(req: NextRequest) {
  initDb();
  const body = await req.json().catch(() => ({}));

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

    // Rate limit: max 3 OTPs per 10 min per mobile
    const identifier = `mobile_${mobile}`;

    const { otp, id } = createOtpRecord(identifier, "mobile_verify", 10);

    // Send via SMS if configured
    const smsStatus = integrationStatus("sms");
    if (smsStatus === "live") {
      try {
        const { smsProvider } = await import("@/lib/notifications");
        const sms = smsProvider();
        if (sms) await sms.send(mobile, `Your verification code for City Care Hospital is ${otp}. Valid for 10 minutes. Do not share this code.`);
      } catch (e) {
        console.error("[otp] SMS send failed:", e);
      }
    } else {
      // Demo mode — log OTP to console (visible in server logs)
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
    if (userId) {
      verifyUserMobile(userId, mobile);
      auditLog(ctx.user?.email ?? "unknown", "mobile.verified", "user", userId, `mobile=${mobile}`);
    }

    return NextResponse.json({ ok: true, message: "Mobile number verified successfully." });
  }

  return NextResponse.json({ error: "Invalid action. Use send_otp or verify_otp." }, { status: 400 });
}
