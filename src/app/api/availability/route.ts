import { NextRequest, NextResponse } from "next/server";
import { getDayAvailability } from "@/lib/booking";
import { getConfig, integrationStatus } from "@/lib/config";
import { todayKey, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Live slot availability.
 * Demo Mode: computed from the local clinic schedule (DB).
 * Live Mode: additionally cross-checked against Google Calendar.
 */
export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date");
    const mode = (req.nextUrl.searchParams.get("mode") === "online" ? "online" : "in_person") as "in_person" | "online";
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
    }
    if (date < todayKey()) return NextResponse.json({ error: "Past dates are not available." }, { status: 400 });
    const cfg = getConfig();
    if (date > addDays(todayKey(), cfg.booking.maxAdvanceDays)) {
      return NextResponse.json({ error: "Bookings are not open that far ahead." }, { status: 400 });
    }
    const day = await getDayAvailability(date, mode);
    return NextResponse.json({
      date,
      mode,
      open: day.open,
      slots: day.slots,
      // Never present simulated availability as live availability.
      mode_label: integrationStatus("calendar") === "live" ? "live" : "demo",
      timezone: cfg.booking.timezone,
    });
  } catch (e) {
    return NextResponse.json({ error: "Unable to load availability. Please try again." }, { status: 500 });
  }
}
