import { NextRequest, NextResponse } from "next/server";
import { trackEvent, queryEvents, countEvents, getAnalyticsDashboard, generateCsvExport, getIdentifiedVisitors } from "@/lib/analytics";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";
import { auditLog } from "@/lib/audit";

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
    if (!allowedTypes.includes(body.event_type)) {
      return NextResponse.json({ error: "Unsupported analytics event type." }, { status: 400 });
    }
    const ctx = await getAuthContext(req);
    if (body.event_type === "page_view") {
      if (!ctx.user || ctx.user.role !== "patient" || ctx.user.status !== "active" || !ctx.user.mobile_verified || !ctx.user.consent_given) {
        return NextResponse.json({ error: "Verified visitor sign-in and consent are required." }, { status: 403 });
      }
      if (typeof body.page !== "string" || !body.page.startsWith("/") || body.page.startsWith("//") || body.page.includes("?") || body.page.length > 300) {
        return NextResponse.json({ error: "Invalid page path." }, { status: 400 });
      }
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? null;
    const sessionId = typeof body.session_id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(body.session_id) ? body.session_id : null;
    const safePage = typeof body.page === "string" && body.page.length <= 300 ? body.page.split(/[?#]/, 1)[0] : null;
    const eventId = trackEvent({
      event_type: body.event_type,
      page: safePage ?? (body.event_type === "page_view" ? null : req.headers.get("referer") ?? null),
      resource_id: typeof body.resource_id === "string" ? body.resource_id.slice(0, 100) : null,
      resource_type: typeof body.resource_type === "string" ? body.resource_type.slice(0, 50) : null,
      user_id: ctx.user?.id ?? null,
      session_id: sessionId,
      hospital_id: ctx.user?.hospital_id ?? (ctx.user?.role === "patient" ? "hosp_default" : null),
      appointment_ref: typeof body.appointment_ref === "string" ? body.appointment_ref.slice(0, 50) : null,
      outcome: typeof body.outcome === "string" ? body.outcome.slice(0, 100) : null,
      error_code: typeof body.error_code === "string" ? body.error_code.slice(0, 100) : null,
      metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : null,
      ip,
      user_agent: req.headers.get("user-agent") ?? null,
      // Do not persist full referrers which can contain query-string PII.
      referrer: null,
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

  if (ctx.user && (ctx.user.status === "suspended" || ctx.user.status === "inactive")) {
    return NextResponse.json({ error: "Account is inactive." }, { status: 403 });
  }
  if (ctx.user && (!ctx.user.mobile_verified || !ctx.user.consent_given)) {
    return NextResponse.json({ error: "Verified sign-in and consent are required." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "dashboard";
  const hospital_id = role === "hospital_owner" ? ctx.user?.hospital_id ?? "hosp_default" : (searchParams.get("hospital_id") || undefined);

  if (view === "dashboard") {
    const dashboard = getAnalyticsDashboard(hospital_id ?? undefined);
    return NextResponse.json({ dashboard });
  }

  if (view === "visitors") {
    return NextResponse.json({ visitors: getIdentifiedVisitors(hospital_id ?? undefined) });
  }

  if (view === "visitors_export") {
    const visitors = getIdentifiedVisitors(hospital_id ?? undefined);
    auditLog(ctx.user?.email ?? ctx.session?.admin?.username ?? "admin", "analytics.visitors.export", "visitor", null, `rows=${visitors.length}`);
    const esc = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const columns = ["Name", "Email", "Mobile", "First Seen", "Last Seen", "Page Views", "Last Page"] as const;
    const lines = visitors.map((v) => [v.name, v.email, v.mobile, v.first_seen, v.last_seen, v.page_views, v.last_page].map(esc).join(","));
    return new NextResponse([columns.map(esc).join(","), ...lines].join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=identified-visitors-${new Date().toISOString().slice(0, 10)}.csv`,
        "Cache-Control": "no-store",
      },
    });
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
