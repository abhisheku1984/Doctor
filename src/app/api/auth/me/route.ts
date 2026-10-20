import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  if (!ctx.session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (ctx.user) {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        name: ctx.user.name,
        role: ctx.user.role,
        hospital_id: ctx.user.hospital_id,
        mobile: ctx.user.mobile,
        mobile_verified: !!ctx.user.mobile_verified,
        avatar_url: ctx.user.avatar_url,
        status: ctx.user.status,
      },
    });
  }

  // Legacy admin session
  if (ctx.session.admin) {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: "admin_legacy",
        email: ctx.session.admin.username,
        name: ctx.session.admin.username,
        role: "super_admin",
        hospital_id: null,
        status: "active",
      },
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
