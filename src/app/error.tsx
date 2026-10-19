"use client";

import { Button } from "@/components/ui";

/** Error & recovery page — graceful failure, no sensitive detail leaked. */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[site error]", error);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold text-navy-900">Something went wrong</h1>
      <p className="mt-3 text-navy-600">
        We hit an unexpected error. Your booking was not affected unless you see a confirmation.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => history.back()}>Go back</Button>
      </div>
      <p className="mt-6 text-sm text-navy-500">
        Still stuck? Call the clinic — or for a medical emergency in India, dial <strong>112</strong>.
      </p>
    </div>
  );
}
