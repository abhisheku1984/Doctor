import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { integrationStatus } from "@/lib/config";
import { testCalendarConnection } from "@/lib/google/calendar";
import { testSheetsConnection, createRegisterSpreadsheet } from "@/lib/google/sheets";
import { emailProvider, smsProvider } from "@/lib/notifications";
import { avatarCapabilities, avatarProviderName } from "@/lib/avatar";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Overview of every integration + credentials checklist. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const status = {
    calendar: integrationStatus("calendar"),
    sheets: integrationStatus("sheets"),
    email: integrationStatus("email"),
    sms: integrationStatus("sms"),
    avatar: integrationStatus("avatar"),
    onlineConsult: integrationStatus("onlineConsult"),
  };
  const avatar = avatarCapabilities();
  return NextResponse.json({
    ok: true,
    status,
    demoMode: status.calendar !== "live" || status.sheets !== "live",
    avatar: { ...avatar, activeProvider: avatarProviderName() },
    requirements: {
      calendar: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_CALENDAR_ID"],
      sheets: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SHEETS_SPREADSHEET_ID"],
      email: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
      sms: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "SMS_NOTIFICATIONS_ENABLED=true"],
      avatar: ["AVATAR_PROVIDER=heygen|did + provider API key"],
    },
  });
}

/** Test a specific integration live. */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const actor = (await (await import("@/lib/auth")).readSession(req))!.admin!.username;
  auditLog(actor, "integration.test", body.target ?? "unknown");

  switch (body.target) {
    case "calendar": {
      const r = await testCalendarConnection();
      return NextResponse.json(r);
    }
    case "sheets": {
      const r = await testSheetsConnection();
      return NextResponse.json(r);
    }
    case "email": {
      const r = await emailProvider().send(
        process.env.STAFF_ALERT_EMAIL ?? "clinic@example.com",
        "Connection test — Dr. XYZ Clinic",
        "This is a test email from the clinic booking system."
      );
      return NextResponse.json({ ok: r.ok, message: r.ok ? "Test email delivered." : `Failed: ${r.error}` });
    }
    case "sms": {
      const p = smsProvider();
      if (!p) return NextResponse.json({ ok: false, message: "SMS notifications are disabled (SMS_NOTIFICATIONS_ENABLED != true)." });
      const r = await p.send(process.env.TEST_SMS_NUMBER ?? "9999999999", "Clinic system test message.");
      return NextResponse.json({ ok: r.ok, message: r.ok ? "Test SMS delivered." : `Failed: ${r.error}` });
    }
    case "sheets-create": {
      try {
        const id = await createRegisterSpreadsheet();
        return NextResponse.json({ ok: true, message: `Spreadsheet created: ${id}. Set GOOGLE_SHEETS_SPREADSHEET_ID to this value.` });
      } catch (e) {
        return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 500 });
      }
    }
    default:
      return NextResponse.json({ ok: false, message: "Unknown integration." }, { status: 400 });
  }
}
