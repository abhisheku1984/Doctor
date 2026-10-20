"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Links page-view events only to signed-in, mobile-verified patient accounts. */
export default function VisitorTracker() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (/^\/(admin|login|phone-login|verify-mobile|privacy|terms)(\/|$)/.test(pathname)) return;

    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.user || data.user.role !== "patient" || !data.user.mobile_verified || !data.user.consent_given) return;
        let sessionId = sessionStorage.getItem("visitor_analytics_session");
        if (!sessionId) {
          sessionId = `vs-${crypto.randomUUID()}`;
          sessionStorage.setItem("visitor_analytics_session", sessionId);
        }
        return fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: "page_view", page: pathname, session_id: sessionId }),
          keepalive: true,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  return null;
}
