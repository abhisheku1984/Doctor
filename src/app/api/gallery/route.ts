import { NextRequest, NextResponse } from "next/server";
import { listGalleryItems, listAllGalleryItems, countGalleryItems, createGalleryItem, GALLERY_CATEGORIES } from "@/lib/gallery";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "all";
  const hospital_id = searchParams.get("hospital_id") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;
  const search = searchParams.get("search") || undefined;

  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  const canManage = !!role && ["super_admin", "hospital_owner"].includes(role);
  const wantsAll = searchParams.get("status") === "all" && canManage;
  const scopedHospital = role === "hospital_owner" ? ctx.user?.hospital_id ?? "hosp_default" : hospital_id;
  const items = wantsAll
    ? listAllGalleryItems({ hospital_id: scopedHospital, category, limit, offset })
    : listGalleryItems({ hospital_id: scopedHospital, category, status: "published", search, limit, offset });
  const total = countGalleryItems({ hospital_id: scopedHospital, category, status: wantsAll ? undefined : "published" });

  return NextResponse.json({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    categories: GALLERY_CATEGORIES,
  });
}

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized. Only admins can add gallery items." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { category, title, caption, file_type, drive_file_id, thumbnail_url, display_url, file_name, mime_type, status } = body;

    if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });

    const item = createGalleryItem({
      hospital_id: role === "super_admin" ? body.hospital_id ?? "hosp_default" : ctx.user?.hospital_id ?? "hosp_default",
      category,
      title: title ?? null,
      caption: caption ?? null,
      file_type: file_type ?? "image",
      drive_file_id: drive_file_id ?? null,
      thumbnail_url: thumbnail_url ?? display_url ?? null,
      display_url: display_url ?? null,
      file_name: file_name ?? null,
      mime_type: mime_type ?? null,
      status: status ?? "published",
      uploaded_by: ctx.user?.id ?? ctx.session?.admin?.username ?? "admin",
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
