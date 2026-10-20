import { Suspense } from "react";
import VerifyMobileContent from "@/components/content/VerifyMobileContent";

export const metadata = { title: "Verify Mobile — Hospital Management System" };
export const dynamic = "force-dynamic";

export default function VerifyMobilePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-navy-400">Loading…</div>}>
      <VerifyMobileContent />
    </Suspense>
  );
}
