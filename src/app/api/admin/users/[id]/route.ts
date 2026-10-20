import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser, deleteUser } from "@/lib/users";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const user = getUserById(params.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (role === "hospital_owner" && user.hospital_id !== ctx.user?.hospital_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { password_hash, ...safe } = user as any;
  return NextResponse.json({ user: safe });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const user = getUserById(params.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (role === "hospital_owner") {
    if (user.hospital_id !== ctx.user?.hospital_id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (user.role === "super_admin") return NextResponse.json({ error: "Cannot modify super_admin." }, { status: 403 });
  }

  try {
    const body = await req.json();
    // Hospital owner can't escalate privileges
    if (role === "hospital_owner" && body.role === "super_admin") {
      return NextResponse.json({ error: "Cannot promote to super_admin." }, { status: 403 });
    }
    const updated = updateUser(params.id, body, ctx.user?.email ?? "admin");
    const { password_hash, ...safe } = updated as any;
    return NextResponse.json({ ok: true, user: safe });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const user = getUserById(params.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (role === "hospital_owner" && user.hospital_id !== ctx.user?.hospital_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (user.role === "super_admin" && ctx.user?.id !== user.id) {
    // Only self or another super_admin can deactivate super_admin
    if (role !== "super_admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  deleteUser(params.id, ctx.user?.email ?? "admin");
  return NextResponse.json({ ok: true });
}
