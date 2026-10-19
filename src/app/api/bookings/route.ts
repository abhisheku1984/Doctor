import { NextRequest, NextResponse } from "next/server";
import { createBookingIdempotent, SlotUnavailableError, ValidationError } from "@/lib/booking";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  patientName: z.string().min(2).max(80),
  patientMobile: z.string(),
  patientEmail: z.string().email().optional().or(z.literal("")),
  isNewPatient: z.boolean().default(true),
  mode: z.enum(["in_person", "online"]),
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(200).optional(),
  consentReminders: z.boolean().default(false),
});

/**
 * Create an appointment.
 * Concurrency-safe: the slot is re-checked inside a DB transaction
 * before reservation; simultaneous requests for the same slot
 * cannot both succeed.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const idempotencyKey = req.headers.get("x-idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing idempotency key." }, { status: 400 });
    }
    const { appointment, duplicated } = await createBookingIdempotent(parsed.data, idempotencyKey);
    return NextResponse.json({ ok: true, duplicated, appointment }, { status: duplicated ? 200 : 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message, fields: e.fields }, { status: 400 });
    }
    if (e instanceof SlotUnavailableError) {
      return NextResponse.json(
        { error: e.message, alternatives: e.alternatives },
        { status: 409 }
      );
    }
    console.error("[booking] failed", e);
    return NextResponse.json({ error: "Booking could not be completed. Please try again." }, { status: 500 });
  }
}
