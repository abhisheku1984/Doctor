import { NextRequest, NextResponse } from "next/server";
import { findAppointment, cancelAppointment, rescheduleAppointment, SlotUnavailableError, bookingSummary } from "@/lib/booking";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Patient self-service: look up an appointment by reference +
 * registered mobile number. Never exposes other patients' data.
 */
export async function GET(req: NextRequest, { params }: { params: { ref: string } }) {
  const mobile = req.nextUrl.searchParams.get("mobile");
  if (!params.ref || !mobile) return NextResponse.json({ error: "Reference and mobile number are required." }, { status: 400 });
  const apt = findAppointment(params.ref.toUpperCase(), mobile.replace(/\D/g, "").slice(-10));
  if (!apt) return NextResponse.json({ error: "No appointment found for that reference and mobile number." }, { status: 404 });
  return NextResponse.json({ ok: true, appointment: bookingSummary(apt), raw: apt });
}

export async function POST(req: NextRequest, { params }: { params: { ref: string } }) {
  const mobile = req.nextUrl.searchParams.get("mobile");
  const action = req.nextUrl.searchParams.get("action");
  if (!params.ref || !mobile) return NextResponse.json({ error: "Reference and mobile number are required." }, { status: 400 });
  try {
    if (action === "cancel") {
      const body = await req.json().catch(() => ({}));
      const apt = await cancelAppointment(params.ref.toUpperCase(), mobile.replace(/\D/g, "").slice(-10), body.reason);
      return NextResponse.json({ ok: true, appointment: bookingSummary(apt) });
    }
    if (action === "reschedule") {
      const body = await req.json();
      const parsed = z.object({ date: z.string(), time: z.string() }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid reschedule request." }, { status: 400 });
      const apt = await rescheduleAppointment(params.ref.toUpperCase(), mobile.replace(/\D/g, "").slice(-10), parsed.data.date, parsed.data.time);
      return NextResponse.json({ ok: true, appointment: bookingSummary(apt) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof SlotUnavailableError) {
      return NextResponse.json({ error: e.message, alternatives: e.alternatives }, { status: 409 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 400 });
  }
}
