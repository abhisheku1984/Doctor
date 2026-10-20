import { NextRequest, NextResponse } from "next/server";
import { listUsers, createUser, countUsers } from "@/lib/users";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filterRole = searchParams.get("role") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

  // Hospital owner sees only their hospital's users
  let hospital_id: string | undefined;
  if (role === "hospital_owner") {
    hospital_id = ctx.user?.hospital_id ?? undefined;
  } else {
    hospital_id = searchParams.get("hospital_id") || undefined;
  }

  const users = listUsers({ role: filterRole, hospital_id, status, search, limit, offset });
  const total = countUsers({ role: filterRole, hospital_id, status });

  // Don't expose password hashes
  const safe = users.map(({ ...u }: any) => { delete u.password_hash; return u; });

  return NextResponse.json({ users: safe, total, limit, offset });
}

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.email || !body.name || !body.role) {
      return NextResponse.json({ error: "email, name, and role are required." }, { status: 400 });
    }

    // Hospital owners can't create super_admins
    if (role === "hospital_owner" && body.role === "super_admin") {
      return NextResponse.json({ error: "Cannot create super_admin." }, { status: 403 });
    }

    let hospital_id = body.hospital_id ?? null;
    if (role === "hospital_owner") {
      hospital_id = ctx.user?.hospital_id ?? null;
    }

    const user = createUser({
      email: body.email,
      name: body.name,
      role: body.role,
      mobile: body.mobile ?? null,
      mobile_verified: body.mobile_verified ?? false,
      hospital_id,
      password: body.password,
      status: body.status ?? "active",
    }, ctx.user?.email ?? ctx.session?.admin?.username ?? "admin");

    const { password_hash, ...safe } = user as any;
    return NextResponse.json({ ok: true, user: safe }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
