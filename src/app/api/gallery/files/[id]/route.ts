import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { initDb } from "@/lib/db";
import { getGalleryItem } from "@/lib/gallery";
import { getAuthContext } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  initDb();
  const item = getGalleryItem(params.id);
  if (!item || !item.local_path) return NextResponse.json({ error: "File not found." }, { status: 404 });

  if (item.status !== "published") {
    const ctx = await getAuthContext(req);
    const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
    const owns = role === "super_admin" || (role === "hospital_owner" && (!ctx.user?.hospital_id || ctx.user.hospital_id === item.hospital_id));
    if (!owns) return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const root = path.resolve(process.cwd(), "data", "gallery");
  const filePath = path.resolve(process.cwd(), item.local_path);
  if (!filePath.startsWith(root + path.sep)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    const bytes = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": item.mime_type || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${(item.file_name || "gallery-file").replace(/[\r\n"\\]/g, "_")}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": item.status === "published" ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File is missing from local storage." }, { status: 404 });
  }
}
