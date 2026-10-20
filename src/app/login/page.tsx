import { Suspense } from "react";
import LoginContent from "@/components/content/LoginContent";

export const metadata = { title: "Sign in — Hospital Management System" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-navy-400">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
