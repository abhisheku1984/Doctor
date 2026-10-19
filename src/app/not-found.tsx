import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl font-semibold text-navy-200">404</p>
      <h1 className="font-display mt-4 text-3xl font-semibold text-navy-900">Page not found</h1>
      <p className="mt-3 text-navy-600">The page you&apos;re looking for has moved or doesn&apos;t exist.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/"><Button>Home</Button></Link>
        <Link href="/book"><Button variant="secondary">Book an appointment</Button></Link>
      </div>
    </div>
  );
}
