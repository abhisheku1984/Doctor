import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/session";

/**
 * Edge guard for the admin portal. Authorization is enforced
 * again on every server operation (defense in depth) —
 * hiding links in the frontend is never relied upon.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = await verifySessionValue(req.cookies.get("drxyz_admin_session")?.value);
    if (!session?.admin) {
      const url = new URL("/admin/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
