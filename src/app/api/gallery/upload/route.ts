import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-guard";
import { createGalleryItem, updateGalleryItem, isValidCategory } from "@/lib/gallery";
import { uploadToDrive, isDriveConfigured, GALLERY_FOLDERS } from "@/lib/google/drive";
import { initDb } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

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
    const hospital_id = role === "super_admin"
      ? (formData.get("hospital_id") as string) || "hosp_default"
      : ctx.user?.hospital_id || "hosp_default";

    if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    if (!isValidCategory(category)) return NextResponse.json({ error: "Invalid gallery category." }, { status: 400 });

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
      try {
        const folderPath = GALLERY_FOLDERS[category] || GALLERY_FOLDERS["general"];
        const result = await uploadToDrive({ fileName: file.name, mimeType: file.type, buffer, folderPath });
        if (result.ok && result.file) {
          driveFileId = result.file.id;
          driveFolderId = result.file.parents?.[0] ?? null;
          displayUrl = `https://drive.google.com/uc?export=view&id=${result.file.id}`;
          thumbnailUrl = `https://drive.google.com/thumbnail?id=${result.file.id}&sz=w400`;
        } else {
          console.warn("[gallery] Drive upload failed; falling back to local storage:", result.error);
        }
      } catch (e) {
        console.warn("[gallery] Drive upload errored; falling back to local storage:", e);
      }
    }

    const fileType = file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "document" : "image";
    let localPath: string | null = null;
    if (!driveFileId) {
      const extension: Record<string, string> = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
        "video/mp4": ".mp4", "video/webm": ".webm", "application/pdf": ".pdf",
      };
      const diskName = `${crypto.randomUUID()}${extension[file.type]}`;
      const diskDir = path.join(process.cwd(), "data", "gallery");
      await fs.mkdir(diskDir, { recursive: true });
      await fs.writeFile(path.join(diskDir, diskName), buffer, { flag: "wx" });
      localPath = `data/gallery/${diskName}`;
    }

    let item = createGalleryItem({
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
      local_path: localPath,
      status: "published",
      uploaded_by: ctx.user?.id ?? ctx.session?.admin?.username ?? "admin",
    }, ctx.user?.email ?? ctx.session?.admin?.username ?? "admin");
    if (localPath) {
      const localUrl = `/api/gallery/files/${item.id}`;
      item = updateGalleryItem(item.id, { display_url: localUrl, thumbnail_url: fileType === "image" ? localUrl : null });
    }

    return NextResponse.json({
      ok: true,
      item,
      driveConfigured: isDriveReady,
      driveUploaded: !!driveFileId,
      message: driveFileId
        ? "Uploaded to Google Drive successfully."
        : isDriveReady ? "Drive upload failed; file saved locally as a fallback." : "File saved locally. Configure Google Drive for cloud storage.",
    }, { status: 201 });
  } catch (e) {
    console.error("[gallery] upload error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
