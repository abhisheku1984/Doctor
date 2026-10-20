import { Suspense } from "react";
import PhoneLoginContent from "@/components/content/PhoneLoginContent";

export const metadata = { title: "Sign in with mobile — City Care Hospital" };

export default function PhoneLoginPage() {
  return <Suspense fallback={<div className="min-h-[60vh]" />}><PhoneLoginContent /></Suspense>;
}
