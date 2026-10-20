/**
 * Gallery management — DB operations + Drive sync.
 * Gallery items have metadata in SQLite, files in Google Drive (or local demo).
 */
import crypto from "crypto";
import { getDb } from "./db";
import type { GalleryItem } from "./db";
import { auditLog } from "./audit";

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

export const GALLERY_CATEGORIES = [
  { id: "hospital_images", label: "Hospital Images", labelHi: "अस्पताल की तस्वीरें" },
  { id: "facilities", label: "Facilities", labelHi: "सुविधाएँ" },
  { id: "events", label: "Events", labelHi: "कार्यक्रम" },
  { id: "doctors", label: "Doctors", labelHi: "डॉक्टर" },
  { id: "videos", label: "Videos", labelHi: "वीडियो" },
  { id: "banners", label: "Banners", labelHi: "बैनर" },
  { id: "general", label: "General", labelHi: "सामान्य" },
] as const;

export function isValidCategory(cat: string): boolean {
  return GALLERY_CATEGORIES.some((c) => c.id === cat);
}

export function listGalleryItems(filter: {
  hospital_id?: string;
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): GalleryItem[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.category && filter.category !== "all") { clauses.push("category = ?"); params.push(filter.category); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  else { clauses.push("status = 'published'"); }
  if (filter.search) {
    clauses.push("(title LIKE ? OR caption LIKE ?)");
    const q = `%${filter.search}%`; params.push(q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  return getDb().prepare(`SELECT * FROM gallery_items ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`).all(...params as any[], limit, offset) as unknown as GalleryItem[];
}

export function listAllGalleryItems(filter: { hospital_id?: string; category?: string; status?: string; limit?: number } = {}): GalleryItem[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.category && filter.category !== "all") { clauses.push("category = ?"); params.push(filter.category); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 200;
  return getDb().prepare(`SELECT * FROM gallery_items ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ?`).all(...params as any[], limit) as unknown as GalleryItem[];
}

export function countGalleryItems(filter: { hospital_id?: string; category?: string; status?: string } = {}): number {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.category && filter.category !== "all") { clauses.push("category = ?"); params.push(filter.category); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (getDb().prepare(`SELECT COUNT(*) as c FROM gallery_items ${where}`).get(...params as any[]) as { c: number }).c;
}

export function getGalleryItem(id: string): GalleryItem | null {
  return (getDb().prepare("SELECT * FROM gallery_items WHERE id = ?").get(id) as unknown as GalleryItem) || null;
}

export interface CreateGalleryInput {
  hospital_id?: string | null;
  category: string;
  title?: string | null;
  caption?: string | null;
  file_type?: string;
  drive_file_id?: string | null;
  drive_folder_id?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  thumbnail_url?: string | null;
  display_url?: string | null;
  local_path?: string | null;
  status?: string;
  sort_order?: number;
  uploaded_by?: string | null;
}

export function createGalleryItem(input: CreateGalleryInput, actor?: string): GalleryItem {
  const id = genId("gal");
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO gallery_items (id, hospital_id, category, title, caption, file_type, drive_file_id, drive_folder_id, file_name, mime_type, file_size, thumbnail_url, display_url, local_path, status, sort_order, uploaded_by, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.hospital_id ?? "hosp_default", input.category, input.title ?? null, input.caption ?? null,
    input.file_type ?? "image", input.drive_file_id ?? null, input.drive_folder_id ?? null,
    input.file_name ?? null, input.mime_type ?? null, input.file_size ?? null,
    input.thumbnail_url ?? null, input.display_url ?? null, input.local_path ?? null,
    input.status ?? "published", input.sort_order ?? 0, input.uploaded_by ?? null,
    now, now, input.status === "published" || !input.status ? now : null
  );
  if (actor) auditLog(actor, "gallery.created", "gallery_item", id, `${input.category}: ${input.title ?? input.file_name ?? ""}`);
  return getGalleryItem(id)!;
}

export function updateGalleryItem(id: string, updates: Partial<CreateGalleryInput> & { status?: string }, actor?: string): GalleryItem {
  const item = getGalleryItem(id);
  if (!item) throw new Error("Gallery item not found.");

  const allowed = ["hospital_id", "category", "title", "caption", "file_type", "drive_file_id", "drive_folder_id", "file_name", "mime_type", "file_size", "thumbnail_url", "display_url", "local_path", "status", "sort_order"] as const;
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const k of allowed) {
    if ((updates as Record<string, unknown>)[k] !== undefined) {
      fields.push(`${k} = ?`);
      vals.push((updates as Record<string, unknown>)[k]);
    }
  }
  if (!fields.length) return item;

  // Handle published_at
  if (updates.status === "published" && item.status !== "published") {
    fields.push("published_at = ?"); vals.push(new Date().toISOString());
  }

  fields.push("updated_at = ?"); vals.push(new Date().toISOString());
  vals.push(id);
  getDb().prepare(`UPDATE gallery_items SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as any[]));
  if (actor) auditLog(actor, "gallery.updated", "gallery_item", id, JSON.stringify(updates));
  return getGalleryItem(id)!;
}

export function deleteGalleryItem(id: string, actor?: string): void {
  const item = getGalleryItem(id);
  if (!item) throw new Error("Gallery item not found.");
  getDb().prepare("DELETE FROM gallery_items WHERE id = ?").run(id);
  if (actor) auditLog(actor, "gallery.deleted", "gallery_item", id);
}

export function reorderGalleryItems(orderedIds: string[], actor?: string): void {
  const d = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    d.prepare("UPDATE gallery_items SET sort_order = ?, updated_at = ? WHERE id = ?").run(i, new Date().toISOString(), orderedIds[i]);
  }
  if (actor) auditLog(actor, "gallery.reordered", "gallery", null, `${orderedIds.length} items`);
}

export function getGalleryStats(hospitalId?: string): { total: number; byCategory: Record<string, number>; published: number; draft: number } {
  const d = getDb();
  const total = (d.prepare(`SELECT COUNT(*) as c FROM gallery_items ${hospitalId ? "WHERE hospital_id = ?" : ""}`).get(...(hospitalId ? [hospitalId] : [])) as { c: number }).c;
  const published = (d.prepare(`SELECT COUNT(*) as c FROM gallery_items WHERE status = 'published' ${hospitalId ? "AND hospital_id = ?" : ""}`).get(...(hospitalId ? [hospitalId] : [])) as { c: number }).c;
  const draft = (d.prepare(`SELECT COUNT(*) as c FROM gallery_items WHERE status = 'draft' ${hospitalId ? "AND hospital_id = ?" : ""}`).get(...(hospitalId ? [hospitalId] : [])) as { c: number }).c;
  const byCategory: Record<string, number> = {};
  const rows = d.prepare(`SELECT category, COUNT(*) as c FROM gallery_items ${hospitalId ? "WHERE hospital_id = ?" : ""} GROUP BY category`).all(...(hospitalId ? [hospitalId] : [])) as Array<{ category: string; c: number }>;
  for (const r of rows) byCategory[r.category] = r.c;
  return { total, byCategory, published, draft };
}
