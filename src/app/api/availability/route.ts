import { NextRequest, NextResponse } from "next/server";
import { getDayAvailability, getAvailabilityRange } from "@/lib/booking";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const mode = (searchParams.get("mode") as "in_person" | "online") || "in_person";
  const doctorId = searchParams.get("doctor_id") || undefined;
  const hospitalId = searchParams.get("hospital_id") || undefined;

  if (date) {
    const availability = await getDayAvailability(date, mode, { doctorId } as any);
    return NextResponse.json({ availability, mode, doctor_id: doctorId });
  }

  // Range for calendar view
  const days = Math.min(60, Math.max(1, parseInt(searchParams.get("days") || "14")));
  const range = await getAvailabilityRange(days, mode, { doctorId } as any);
  return NextResponse.json({ availability: range, mode, doctor_id: doctorId });
}
