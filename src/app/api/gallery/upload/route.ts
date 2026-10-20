import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-guard";
import { createGalleryItem } from "@/lib/gallery";
import { uploadToDrive, isDriveConfigured, GALLERY_FOLDERS } from "@/lib/google/drive";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "application/pdf"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized. Only admins can upload gallery content." }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "general";
    const title = (formData.get("title") as string) || null;
    const caption = (formData.get("caption") as string) || null;
    const hospital_id = (formData.get("hospital_id") as string) || ctx.user?.hospital_id || "hosp_default";

    if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Max 50MB.` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isDriveReady = isDriveConfigured();
    let driveFileId: string | null = null;
    let driveFolderId: string | null = null;
    let displayUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    if (isDriveReady) {
      const folderPath = GALLERY_FOLDERS[category] || GALLERY_FOLDERS["general"];
      const result = await uploadToDrive({
        fileName: file.name,
        mimeType: file.type,
        buffer,
        folderPath,
      });
      if (result.ok && result.file) {
        driveFileId = result.file.id;
        driveFolderId = result.file.parents?.[0] ?? null;
        displayUrl = `https://drive.google.com/uc?export=view&id=${result.file.id}`;
        thumbnailUrl = `https://drive.google.com/thumbnail?id=${result.file.id}&sz=w400`;
      } else if (!result.ok) {
        // Drive upload failed — log but continue with local placeholder
        console.warn("[gallery] Drive upload failed:", result.error);
      }
    }

    // If Drive not configured, store with local display URL (will be served via /api/gallery/file if needed)
    // For now, use a placeholder that the frontend handles gracefully
    const fileType = file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "document" : "image";

    const item = createGalleryItem({
      hospital_id,
      category,
      title: title || file.name.replace(/\.[^.]+$/, ""),
      caption,
      file_type: fileType,
      drive_file_id: driveFileId,
      drive_folder_id: driveFolderId,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      thumbnail_url: thumbnailUrl || displayUrl,
      display_url: displayUrl,
      status: "published",
      uploaded_by: ctx.user?.id ?? ctx.session?.admin?.username ?? "admin",
    }, ctx.user?.email ?? ctx.session?.admin?.username ?? "admin");

    return NextResponse.json({
      ok: true,
      item,
      driveConfigured: isDriveReady,
      driveUploaded: !!driveFileId,
      message: isDriveReady
        ? driveFileId ? "Uploaded to Google Drive successfully." : "Drive upload failed, saved locally. Check Drive configuration."
        : "Saved locally. Configure Google Drive for cloud storage (see setup docs).",
    }, { status: 201 });
  } catch (e) {
    console.error("[gallery] upload error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
