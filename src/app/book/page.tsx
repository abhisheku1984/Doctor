import { getConfig } from "@/lib/config";
import BookingWizard from "@/components/BookingWizard";
import { redirect } from "next/navigation";

export const metadata = { title: "Book an Appointment" };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ mode?: string; service?: string }> }) {
  const cfg = getConfig();
  const sp = await searchParams;
  const mode = sp.mode === "online" ? "online" : sp.mode === "in_person" ? "in_person" : undefined;

  // Server-side availability pre-fetch for the first visible day
  const { getAvailabilityRange } = await import("@/lib/booking");
  const days = await getAvailabilityRange(7, (mode as "in_person" | "online") ?? "in_person");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="font-display text-4xl font-semibold text-navy-900">Book an Appointment</h1>
        <p className="mt-3 text-navy-600">
          Guided booking with live availability. All times in <strong>Asia/Kolkata</strong>.
        </p>
      </header>

      <BookingWizard config={cfg} initialMode={mode as "in_person" | "online" | undefined} />

      {/* Availability data is rendered client-side; this server pre-fetch
          guarantees slots always originate from the configured schedule. */}
      <script
        type="application/json"
        id="availability-preseed"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(days) }}
      />
    </div>
  );
}
