import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/session";

const AUTH_PAGES = new Set(["/login", "/phone-login", "/verify-mobile", "/admin/login", "/privacy", "/terms"]);

/**
 * Patient-facing website pages require a verified visitor session. API routes
 * retain their own authorization rules; they are not implicitly gated here.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/") || AUTH_PAGES.has(pathname) || /\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

  const adminSession = await verifySessionValue(req.cookies.get("drxyz_admin_session")?.value);
  const userSession = await verifySessionValue(req.cookies.get("hospital_session")?.value);
  const session = adminSession || userSession;
  const legacyAdmin = !!session?.admin;
  const user = session?.user;
  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute) {
    if (!legacyAdmin && !user) {
      const url = new URL("/admin/login", req.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    if (user && !["super_admin", "hospital_owner"].includes(user.role)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (user && (!user.mobile_verified || !user.consent_given)) {
      const url = new URL("/verify-mobile", req.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Legacy server-provisioned admin sessions are an explicit staff bypass.
  if (legacyAdmin) return NextResponse.next();
  if (!user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (!user.mobile_verified || !user.consent_given) {
    const url = new URL("/verify-mobile", req.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
