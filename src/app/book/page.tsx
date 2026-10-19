import { getConfig } from "@/lib/config";
import BookContent from "@/components/content/BookContent";
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
    <>
      <BookContent cfg={cfg} initialMode={mode as "in_person" | "online" | undefined} />

      {/* Availability data is rendered client-side; this server pre-fetch
          guarantees slots always originate from the configured schedule. */}
      <script
        type="application/json"
        id="availability-preseed"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(days) }}
      />
    </>
  );
}
