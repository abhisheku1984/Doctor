import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/session";

/**
 * Route protection for admin and authenticated areas.
 * Authorization is enforced again on every server operation (defense in depth).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin area protection
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const adminSession = await verifySessionValue(req.cookies.get("drxyz_admin_session")?.value);
    const userSession = await verifySessionValue(req.cookies.get("hospital_session")?.value);

    const session = adminSession || userSession;
    if (!session?.admin && !session?.user) {
      const url = new URL("/admin/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Check if user session has appropriate role for admin area
    if (session?.user && session.user.role === "patient") {
      // Patients shouldn't access admin directly — redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Dashboard protection — requires any authenticated user
  if (pathname.startsWith("/dashboard")) {
    const adminSession = await verifySessionValue(req.cookies.get("drxyz_admin_session")?.value);
    const userSession = await verifySessionValue(req.cookies.get("hospital_session")?.value);
    if (!adminSession && !userSession) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
