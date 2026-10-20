import { NextRequest, NextResponse } from "next/server";
import { getGalleryItem, updateGalleryItem, deleteGalleryItem } from "@/lib/gallery";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const item = getGalleryItem(params.id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }
  if (ctx.user && (ctx.user.status === "inactive" || ctx.user.status === "suspended" || !ctx.user.mobile_verified || !ctx.user.consent_given)) {
    return NextResponse.json({ error: "Verified admin access required." }, { status: 403 });
  }
  try {
    const item = getGalleryItem(params.id);
    if (!item || (ctx.user?.role === "hospital_owner" && ctx.user.hospital_id && item.hospital_id !== ctx.user.hospital_id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const body = await req.json();
    if (ctx.user?.role === "hospital_owner") delete body.hospital_id;
    const updated = updateGalleryItem(params.id, body, ctx.user?.email ?? ctx.session?.admin?.username ?? "admin");
    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }
  if (ctx.user && (ctx.user.status === "inactive" || ctx.user.status === "suspended" || !ctx.user.mobile_verified || !ctx.user.consent_given)) {
    return NextResponse.json({ error: "Verified admin access required." }, { status: 403 });
  }
  try {
    const item = getGalleryItem(params.id);
    if (!item || (ctx.user?.role === "hospital_owner" && ctx.user.hospital_id && item.hospital_id !== ctx.user.hospital_id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    deleteGalleryItem(params.id, ctx.user?.email ?? ctx.session?.admin?.username ?? "admin");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
