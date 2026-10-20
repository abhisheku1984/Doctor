"use client";
import { useEffect, useState } from "react";

const CATEGORIES = ["hospital_images", "facilities", "events", "doctors", "videos", "banners", "general"];

export default function AdminGalleryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({ category: "hospital_images", title: "", caption: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: "all", limit: "100" });
    if (filter !== "all") params.set("category", filter);
    const res = await fetch(`/api/gallery?${params}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  };

  const loadDriveStatus = async () => {
    const res = await fetch("/api/admin/drive");
    const data = await res.json();
    setDriveStatus(data);
  };

  useEffect(() => { load(); loadDriveStatus(); }, [filter]);
  useEffect(() => { loadDriveStatus(); }, []);

  const handleUpload = async () => {
    if (!file) { setError("Please select a file."); return; }
    setUploading(true); setError(null); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", form.category);
      if (form.title) fd.append("title", form.title);
      if (form.caption) fd.append("caption", form.caption);
      const res = await fetch("/api/gallery/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(data.message || "Uploaded successfully.");
      setFile(null); setForm({ category: "hospital_images", title: "", caption: "" });
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    load();
  };

  const toggleStatus = async (item: any) => {
    const newStatus = item.status === "published" ? "draft" : "published";
    await fetch(`/api/gallery/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  };

  const syncDrive = async () => {
    setSyncing(true);
    const res = await fetch("/api/admin/drive", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_gallery" }),
    });
    const data = await res.json();
    setMsg(`Synced ${data.synced ?? 0} files from Drive. ${data.errors?.join(", ") ?? ""}`);
    setSyncing(false); load();
  };

  const ensureFolders = async () => {
    setSyncing(true);
    const res = await fetch("/api/admin/drive", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_folders" }),
    });
    const data = await res.json();
    setMsg(data.ok ? `Created ${data.folders?.length ?? 0} folders.` : data.error);
    setSyncing(false); loadDriveStatus();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy-900">Gallery Management</h1>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>

      {/* Drive status */}
      <div className="rounded-2xl border border-navy-100 bg-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-navy-900">Google Drive Integration</p>
            <p className="text-xs text-navy-500">
              {driveStatus?.configured ? "✅ Configured — uploads go to Drive automatically." : "⚠️ Not configured — files stored locally. Set GOOGLE_SERVICE_ACCOUNT_JSON."}
              {driveStatus?.driveConfig?.last_sync_at && ` Last sync: ${new Date(driveStatus.driveConfig.last_sync_at).toLocaleString()}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={ensureFolders} disabled={syncing} className="rounded-xl border border-navy-200 px-3 py-2 text-xs font-medium hover:bg-navy-50 disabled:opacity-50">
              {syncing ? "…" : "Create Drive Folders"}
            </button>
            <button onClick={syncDrive} disabled={syncing} className="rounded-xl bg-navy-900 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-50">
              {syncing ? "Syncing…" : "Sync from Drive"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">{msg}</div>}

      {/* Upload form */}
      <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
        <h3 className="font-semibold text-navy-900">Upload New Image</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
            </select>
          </label>
          <label className="text-sm">Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. New Operation Theatre" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">Caption
            <input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Optional description" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">File (image/video, max 50MB)
            <input type="file" accept="image/*,video/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <button onClick={handleUpload} disabled={uploading || !file} className="mt-4 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {/* Gallery grid */}
      {loading ? <p className="text-sm text-navy-400">Loading gallery…</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft">
              <div className="aspect-[4/3] bg-navy-50 relative">
                {item.file_type === "video" && (item.display_url || item.thumbnail_url) ? (
                  <video src={item.display_url || item.thumbnail_url} controls className="h-full w-full object-cover" aria-label={item.title ?? "Gallery video"} />
                ) : item.file_type === "document" && (item.display_url || item.thumbnail_url) ? (
                  <a href={item.display_url || item.thumbnail_url} target="_blank" rel="noreferrer" className="flex h-full items-center justify-center text-sm font-semibold text-teal-700 underline">Open PDF</a>
                ) : item.thumbnail_url || item.display_url ? (
                  <img src={item.thumbnail_url || item.display_url} alt={item.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-navy-300">No image</div>
                )}
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${item.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{item.status}</span>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-navy-900 truncate">{item.title ?? "Untitled"}</p>
                <p className="text-xs text-navy-400">{item.category} · {item.file_type}</p>
                <div className="mt-2 flex gap-1">
                  <button onClick={() => toggleStatus(item)} className="rounded-lg border border-navy-200 px-2 py-1 text-xs hover:bg-navy-50">
                    {item.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="col-span-full text-center text-sm text-navy-400 py-8">No images yet. Upload your first image above.</p>}
        </div>
      )}
    </div>
  );
}
