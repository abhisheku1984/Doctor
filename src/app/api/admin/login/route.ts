import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createSessionCookie, getAdminPasswordHash, getAdminUsername, readSession, recordLogin, setAdminPassword, verifyPassword } from "@/lib/auth";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

initDb();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.ip ?? "unknown";
  if (!checkRateLimit(ip, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const { username, password, setup } = body as { username?: string; password?: string; setup?: boolean };

  // One-time setup: create the admin password when none exists yet.
  if (setup === true) {
    const existing = getAdminPasswordHash();
    if (existing) return NextResponse.json({ error: "Admin password already set." }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    setAdminPassword(password);
    recordLogin(username ?? "setup", true);
    return NextResponse.json({ ok: true, message: "Admin password created." });
  }

  const expectedUser = getAdminUsername();
  const hash = getAdminPasswordHash();
  const ok = username === expectedUser && !!hash && verifyPassword(String(password ?? ""), hash);
  recordLogin(String(username ?? ""), ok);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, username: expectedUser });
  res.headers.append("Set-Cookie", await createSessionCookie(expectedUser));
  return res;
}

export async function GET(req: NextRequest) {
  const session = await readSession(req);
  if (!session?.admin) return NextResponse.json({ loggedIn: false }, { status: 401 });
  return NextResponse.json({ loggedIn: true, admin: session.admin });
}
