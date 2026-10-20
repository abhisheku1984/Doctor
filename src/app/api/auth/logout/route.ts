import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, clearUserSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  res.headers.append("Set-Cookie", clearUserSessionCookie());
  return res;
}

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.headers.set("Set-Cookie", clearSessionCookie());
  res.headers.append("Set-Cookie", clearUserSessionCookie());
  return res;
}
