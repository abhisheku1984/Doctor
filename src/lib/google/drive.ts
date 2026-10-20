/**
 * Google Drive integration — central content storage.
 *
 * Folder structure:
 * Hospital_Management_System/
 *   Hospital_Profile/
 *   Gallery/
 *     Hospital_Images/ Facilities/ Events/ Doctors/ Videos/ Banners/
 *   Doctors/Profiles/ Schedules/
 *   Appointments/ Billing/Invoices/ Payment_Reports/
 *   Users/ Visitor_Analytics/ Audit_Logs/ Reports/ Backups/
 *
 * When credentials are absent, all operations run in demo/local mode
 * with clear status reporting. Never exposes private tokens to browsers.
 */
import { google, drive_v3 } from "googleapis";
import { getGoogleAuth } from "./auth";

export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

const FOLDER_STRUCTURE: Record<string, string[]> = {
  "Hospital_Management_System": [],
  "Hospital_Management_System/Hospital_Profile": [],
  "Hospital_Management_System/Gallery": [],
  "Hospital_Management_System/Gallery/Hospital_Images": [],
  "Hospital_Management_System/Gallery/Facilities": [],
  "Hospital_Management_System/Gallery/Events": [],
  "Hospital_Management_System/Gallery/Doctors": [],
  "Hospital_Management_System/Gallery/Videos": [],
  "Hospital_Management_System/Gallery/Banners": [],
  "Hospital_Management_System/Doctors": [],
  "Hospital_Management_System/Doctors/Profiles": [],
  "Hospital_Management_System/Doctors/Schedules": [],
  "Hospital_Management_System/Appointments": [],
  "Hospital_Management_System/Billing": [],
  "Hospital_Management_System/Billing/Invoices": [],
  "Hospital_Management_System/Billing/Payment_Reports": [],
  "Hospital_Management_System/Users": [],
  "Hospital_Management_System/Visitor_Analytics": [],
  "Hospital_Management_System/Audit_Logs": [],
  "Hospital_Management_System/Reports": [],
  "Hospital_Management_System/Backups": [],
};

export const GALLERY_FOLDERS: Record<string, string> = {
  hospital_images: "Hospital_Management_System/Gallery/Hospital_Images",
  facilities: "Hospital_Management_System/Gallery/Facilities",
  events: "Hospital_Management_System/Gallery/Events",
  doctors: "Hospital_Management_System/Gallery/Doctors",
  videos: "Hospital_Management_System/Gallery/Videos",
  banners: "Hospital_Management_System/Gallery/Banners",
  general: "Hospital_Management_System/Gallery/Hospital_Images",
};

export const GALLERY_CATEGORIES = [
  { id: "hospital_images", label: "Hospital Images", folder: "Hospital_Images" },
  { id: "facilities", label: "Facilities", folder: "Facilities" },
  { id: "events", label: "Events", folder: "Events" },
  { id: "doctors", label: "Doctors", folder: "Doctors" },
  { id: "videos", label: "Videos", folder: "Videos" },
  { id: "banners", label: "Banners", folder: "Banners" },
  { id: "general", label: "General", folder: "Hospital_Images" },
] as const;

async function getDriveClient(): Promise<{ drive: drive_v3.Drive; auth: InstanceType<typeof google.auth.JWT> } | null> {
  const { jwt, configured } = getGoogleAuth(DRIVE_SCOPES);
  if (!configured || !jwt) return null;
  await jwt.authorize();
  return { drive: google.drive({ version: "v3", auth: jwt }), auth: jwt };
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  path: string;
}

export interface DriveUploadInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folderPath: string; // e.g. "Hospital_Management_System/Gallery/Hospital_Images"
  description?: string;
}

// ---------- Folder management ----------

export async function ensureFolderStructure(): Promise<{ ok: boolean; folders: DriveFolder[]; error?: string }> {
  const ctx = await getDriveClient();
  if (!ctx) return { ok: false, folders: [], error: "Google Drive is not configured." };

  const created: DriveFolder[] = [];
  const folderIds: Map<string, string> = new Map();

  try {
    for (const folderPath of Object.keys(FOLDER_STRUCTURE)) {
      const parts = folderPath.split("/");
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join("/");
      const parentId = parentPath ? folderIds.get(parentPath) : undefined;

      // Check if folder already exists
      let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentId) query += ` and '${parentId}' in parents`;

      const existing = await ctx.drive.files.list({ q: query, fields: "files(id, name)", pageSize: 1 });
      if (existing.data.files && existing.data.files.length > 0) {
        folderIds.set(folderPath, existing.data.files[0].id!);
        created.push({ id: existing.data.files[0].id!, name, path: folderPath });
        continue;
      }

      // Create folder
      const res = await ctx.drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: parentId ? [parentId] : undefined,
        },
        fields: "id, name",
      });
      folderIds.set(folderPath, res.data.id!);
      created.push({ id: res.data.id!, name, path: folderPath });
    }

    // Save to DB
    const { getDb } = await import("../db");
    const now = new Date().toISOString();
    for (const f of created) {
      getDb().prepare(`INSERT OR REPLACE INTO drive_folders (id, name, drive_folder_id, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(f.id, f.name, f.id, f.path, now, now);
    }
    getDb().prepare(`INSERT OR REPLACE INTO drive_config (id, root_folder_id, root_folder_name, structure_created, last_sync_at, created_at, updated_at) VALUES ('default', ?, 'Hospital_Management_System', 1, ?, ?, ?)`)
      .run(created[0]?.id ?? "", now, now, now);

    return { ok: true, folders: created };
  } catch (e) {
    return { ok: false, folders: created, error: (e as Error).message };
  }
}

export async function getFolderId(folderPath: string): Promise<string | null> {
  const { getDb } = await import("../db");
  try {
    const row = getDb().prepare("SELECT drive_folder_id FROM drive_folders WHERE path = ?").get(folderPath) as { drive_folder_id: string } | undefined;
    if (row) return row.drive_folder_id;
  } catch { /* fallback to Drive API */ }

  const ctx = await getDriveClient();
  if (!ctx) return null;

  const parts = folderPath.split("/");
  let parentId: string | undefined;
  for (const name of parts) {
    let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) q += ` and '${parentId}' in parents`;
    const res = await ctx.drive.files.list({ q, fields: "files(id)", pageSize: 1 });
    if (!res.data.files?.length) return null;
    parentId = res.data.files[0].id!;
  }
  return parentId ?? null;
}

// ---------- File operations ----------

export async function uploadToDrive(input: DriveUploadInput): Promise<{ ok: boolean; file?: DriveFile; error?: string }> {
  const ctx = await getDriveClient();
  if (!ctx) return { ok: false, error: "Google Drive is not configured." };

  let folderId: string | null = null;
  if (input.folderPath) {
    folderId = await getFolderId(input.folderPath);
    if (!folderId) {
      // Try to ensure structure exists first
      await ensureFolderStructure();
      folderId = await getFolderId(input.folderPath);
    }
  }

  try {
    const { Readable } = await import("stream");
    const stream = Readable.from(input.buffer);

    const res = await ctx.drive.files.create({
      requestBody: {
        name: input.fileName,
        parents: folderId ? [folderId] : undefined,
        description: input.description,
      },
      media: {
        mimeType: input.mimeType,
        body: stream,
      },
      fields: "id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, parents, createdTime, modifiedTime",
    });

    // Make file accessible for thumbnail generation
    try {
      await ctx.drive.permissions.create({
        fileId: res.data.id!,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch { /* permission may already exist or not needed */ }

    // Log sync
    try {
      const { getDb } = await import("../db");
      getDb().prepare(`INSERT INTO drive_sync_log (operation, drive_file_id, status, created_at, updated_at) VALUES (?, ?, 'completed', ?, ?)`)
        .run("upload", res.data.id!, new Date().toISOString(), new Date().toISOString());
    } catch { /* best effort */ }

    return {
      ok: true,
      file: {
        id: res.data.id!,
        name: res.data.name!,
        mimeType: res.data.mimeType!,
        size: res.data.size ?? undefined,
        thumbnailLink: res.data.thumbnailLink ?? undefined,
        webViewLink: res.data.webViewLink ?? undefined,
        webContentLink: res.data.webContentLink ?? undefined,
        parents: res.data.parents ?? undefined,
        createdTime: res.data.createdTime ?? undefined,
        modifiedTime: res.data.modifiedTime ?? undefined,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function listDriveFiles(folderPath: string, pageSize: number = 100): Promise<{ ok: boolean; files: DriveFile[]; error?: string }> {
  const ctx = await getDriveClient();
  if (!ctx) return { ok: false, files: [], error: "Google Drive is not configured." };

  const folderId = await getFolderId(folderPath);
  if (!folderId) return { ok: false, files: [], error: `Folder not found: ${folderPath}` };

  try {
    const res = await ctx.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, parents, createdTime, modifiedTime)",
      pageSize,
      orderBy: "modifiedTime desc",
    });
    return {
      ok: true,
      files: (res.data.files ?? []).map((f) => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: f.size ?? undefined,
        thumbnailLink: f.thumbnailLink ?? undefined,
        webViewLink: f.webViewLink ?? undefined,
        webContentLink: f.webContentLink ?? undefined,
        parents: f.parents ?? undefined,
        createdTime: f.createdTime ?? undefined,
        modifiedTime: f.modifiedTime ?? undefined,
      })),
    };
  } catch (e) {
    return { ok: false, files: [], error: (e as Error).message };
  }
}

export async function deleteDriveFile(fileId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getDriveClient();
  if (!ctx) return { ok: false, error: "Google Drive is not configured." };
  try {
    await ctx.drive.files.delete({ fileId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getDriveFileMetadata(fileId: string): Promise<{ ok: boolean; file?: DriveFile; error?: string }> {
  const ctx = await getDriveClient();
  if (!ctx) return { ok: false, error: "Google Drive is not configured." };
  try {
    const res = await ctx.drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, parents, createdTime, modifiedTime",
    });
    return {
      ok: true,
      file: {
        id: res.data.id!,
        name: res.data.name!,
        mimeType: res.data.mimeType!,
        size: res.data.size ?? undefined,
        thumbnailLink: res.data.thumbnailLink ?? undefined,
        webViewLink: res.data.webViewLink ?? undefined,
        webContentLink: res.data.webContentLink ?? undefined,
        parents: res.data.parents ?? undefined,
        createdTime: res.data.createdTime ?? undefined,
        modifiedTime: res.data.modifiedTime ?? undefined,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function driveThumbnailUrl(fileId: string, size: number = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

// ---------- Sync helpers ----------

export async function testDriveConnection(): Promise<{ ok: boolean; message: string }> {
  const ctx = await getDriveClient();
  if (!ctx) return { ok: false, message: "Google Drive credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON with Drive scope." };
  try {
    const res = await ctx.drive.about.get({ fields: "user, storageQuota" });
    return { ok: true, message: `Connected as ${res.data.user?.emailAddress ?? "service account"} — Drive API accessible.` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${(e as Error).message}` };
  }
}

export async function syncGalleryFromDrive(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  for (const [category, folderPath] of Object.entries(GALLERY_FOLDERS)) {
    const result = await listDriveFiles(folderPath, 100);
    if (!result.ok) {
      if (result.error && !result.error.includes("not configured")) errors.push(`${category}: ${result.error}`);
      continue;
    }

    const { getDb } = await import("../db");
    const d = getDb();

    for (const file of result.files) {
      // Check if already in gallery
      const existing = d.prepare("SELECT id FROM gallery_items WHERE drive_file_id = ?").get(file.id) as { id: string } | undefined;
      if (existing) continue;

      // Only handle supported image/video types
      const isImage = file.mimeType.startsWith("image/");
      const isVideo = file.mimeType.startsWith("video/");
      if (!isImage && !isVideo) continue;

      const id = `gal_drive_${file.id.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      d.prepare(`INSERT OR IGNORE INTO gallery_items
        (id, category, title, caption, file_type, drive_file_id, drive_folder_id, file_name, mime_type, file_size, thumbnail_url, display_url, status, sort_order, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 0, ?, ?, ?)`)
        .run(
          id, category, file.name.replace(/\.[^.]+$/, ""), null,
          isVideo ? "video" : "image",
          file.id, file.parents?.[0] ?? null, file.name, file.mimeType,
          file.size ? parseInt(file.size) : null,
          driveThumbnailUrl(file.id, 400),
          driveDownloadUrl(file.id),
          now, now, now
        );
      synced++;
    }
  }

  // Update last sync
  try {
    const { getDb } = await import("../db");
    getDb().prepare(`UPDATE drive_config SET last_sync_at = ?, updated_at = ? WHERE id = 'default'`).run(new Date().toISOString(), new Date().toISOString());
  } catch { /* ignore */ }

  return { synced, errors };
}

export function isDriveConfigured(): boolean {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
}
