import { NextResponse } from "next/server";
import { getConfig, integrationStatus, demoMode, launchReadiness } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Public, sanitized clinic configuration for the frontend.
 * Contains NO secrets — server env values are never included.
 */
export function GET() {
  const cfg = getConfig();
  return NextResponse.json({
    doctor: cfg.doctor,
    clinic: cfg.clinic,
    booking: {
      ...cfg.booking,
      modes: cfg.booking.modes,
    },
    services: cfg.services,
    faqs: cfg.faqs,
    avatar: { ...cfg.avatar, capabilities: undefined },
    languages: cfg.languages,
    demoMode: demoMode(),
    integrations: {
      calendar: integrationStatus("calendar"),
      sheets: integrationStatus("sheets"),
      email: integrationStatus("email"),
      sms: integrationStatus("sms"),
      avatar: integrationStatus("avatar"),
      onlineConsult: integrationStatus("onlineConsult"),
    },
    launchReadiness: launchReadiness(),
  });
}
