import { NextRequest, NextResponse } from "next/server";
import { trackEvent, queryEvents, countEvents, getAnalyticsDashboard, generateCsvExport } from "@/lib/analytics";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public: track an event (no auth required, but rate-limited)
export async function POST(req: NextRequest) {
  initDb();
  try {
    const body = await req.json();
    if (!body.event_type) return NextResponse.json({ error: "event_type is required." }, { status: 400 });

    const allowedTypes = [
      "page_view", "gallery_view", "gallery_interaction", "doctor_profile_view",
      "doctor_search", "appointment_booking_start", "appointment_booking_complete",
      "appointment_cancel", "login_success", "login_failure", "search", "contact_form",
    ];
    // Allow any type from public, but validate known ones
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? null;
    const ctx = await getAuthContext(req);

    const eventId = trackEvent({
      event_type: body.event_type,
      page: body.page ?? req.headers.get("referer") ?? null,
      resource_id: body.resource_id ?? null,
      resource_type: body.resource_type ?? null,
      user_id: ctx.user?.id ?? null,
      session_id: body.session_id ?? null,
      hospital_id: body.hospital_id ?? null,
      appointment_ref: body.appointment_ref ?? null,
      outcome: body.outcome ?? null,
      error_code: body.error_code ?? null,
      metadata: body.metadata ?? null,
      ip,
      user_agent: req.headers.get("user-agent") ?? null,
      referrer: req.headers.get("referer") ?? null,
    });

    return NextResponse.json({ ok: true, event_id: eventId }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Admin: query analytics
export async function GET(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized. Analytics access requires admin privileges." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "dashboard";
  const hospital_id = role === "hospital_owner" ? ctx.user?.hospital_id ?? undefined : (searchParams.get("hospital_id") || undefined);

  if (view === "dashboard") {
    const dashboard = getAnalyticsDashboard(hospital_id ?? undefined);
    return NextResponse.json({ dashboard });
  }

  if (view === "export") {
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const event_type = searchParams.get("event_type") || undefined;
    const csv = generateCsvExport({ hospital_id: hospital_id ?? undefined, event_type, from, to });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Query
  const event_type = searchParams.get("event_type") || undefined;
  const page = searchParams.get("page") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const limit = Math.min(1000, parseInt(searchParams.get("limit") || "100"));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

  const events = queryEvents({ event_type, page, hospital_id: hospital_id ?? undefined, from, to, limit, offset });
  const total = countEvents({ event_type, page, hospital_id: hospital_id ?? undefined, from, to });

  return NextResponse.json({ events, total, limit, offset });
}
