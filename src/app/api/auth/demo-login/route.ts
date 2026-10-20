import { NextRequest, NextResponse } from "next/server";
import { initDb, getDb } from "@/lib/db";
import { ensureSuperAdmin, createUser } from "@/lib/users";
import { createUserSessionValue, createSessionValue } from "@/lib/session";

export const dynamic = "force-dynamic";

const DEMO: Record<string, { email: string; name: string; role: string; mobile: string }> = {
  patient:        { email: "demo.patient@example.com",       name: "Demo Patient",       role: "patient",        mobile: "9000000001" },
  hospital_owner: { email: "demo.owner@example.com",         name: "Demo Hospital Owner",role: "hospital_owner", mobile: "9000000002" },
  super_admin:    { email: "demo.superadmin@example.com",    name: "Demo Super Admin",   role: "super_admin",    mobile: "9000000003" },
};

export async function POST(req: NextRequest) {
  initDb();
  let body: { role?: string } = {};
  try { body = await req.json(); } catch {}
  const role = (body.role || "").trim();
  if (!DEMO[role]) return NextResponse.json({ error: "Invalid role. Use patient | hospital_owner | super_admin" }, { status: 400 });

  const cfg = DEMO[role];
  const superEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@hospital.local";
  ensureSuperAdmin(superEmail, "Super Admin", process.env.SUPER_ADMIN_PASSWORD);
  const d = getDb();
  let user = d.prepare("SELECT * FROM users WHERE email = ?").get(cfg.email) as Record<string,string> | undefined;
  if (!user) {
    createUser({ email: cfg.email, name: cfg.name, role: cfg.role as never, mobile: cfg.mobile, hospital_id: null, google_sub: null, avatar_url: null });
    user = d.prepare("SELECT * FROM users WHERE email = ?").get(cfg.email) as Record<string,string>;
  }
  const token = await createUserSessionValue({ id: user!.id, email: user!.email, name: user!.name, role: user!.role, hospital_id: (user!.hospital_id as string) || null, avatar_url: user!.avatar_url as string });
  const res = NextResponse.json({ ok: true, role: user!.role, next: role === "patient" ? "/dashboard" : "/admin" });
  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = `Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${isProd ? "; Secure" : ""}`;
  // user cookie + legacy admin cookie both understood by middleware
  res.headers.append("Set-Cookie", `hospital_session=${token}; ${cookieOpts}`);
  if (user!.role === "super_admin" || user!.role === "hospital_owner") {
    const adminToken = await createSessionValue(user!.email);
    res.headers.append("Set-Cookie", `drxyz_admin_session=${adminToken}; ${cookieOpts}`);
  }
  return res;
}
