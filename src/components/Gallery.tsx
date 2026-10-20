"use client";

import { useEffect, useState, useCallback } from "react";

interface GalleryItem {
  id: string;
  category: string;
  title: string | null;
  caption: string | null;
  file_type: string;
  thumbnail_url: string | null;
  display_url: string | null;
  mime_type: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  hospital_images: "Hospital",
  facilities: "Facilities",
  events: "Events",
  doctors: "Doctors",
  videos: "Videos",
  banners: "Banners",
  general: "General",
};

const CATEGORIES = ["all", "hospital_images", "facilities", "events", "doctors", "videos", "banners"];

export default function Gallery({ hospitalId }: { hospitalId?: string }) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchItems = useCallback(async (cat: string, p: number, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ category: cat, page: String(p), limit: "12" });
      if (hospitalId) params.set("hospital_id", hospitalId);
      const res = await fetch(`/api/gallery?${params}`);
      if (!res.ok) throw new Error("Failed to load gallery.");
      const data = await res.json();
      if (append) setItems((prev) => [...prev, ...data.items]);
      else setItems(data.items);
      setHasMore(data.pagination.page < data.pagination.totalPages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    setPage(1);
    fetchItems(category, 1);
  }, [category, fetchItems]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchItems(category, next, true);
  };

  const openLightbox = (item: GalleryItem) => {
    const idx = items.findIndex((i) => i.id === item.id);
    setLightboxIndex(idx);
    setLightbox(item);
  };

  const navigateLightbox = (dir: number) => {
    const next = lightboxIndex + dir;
    if (next >= 0 && next < items.length) {
      setLightboxIndex(next);
      setLightbox(items[next]);
    }
  };

  // Keyboard nav for lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "ArrowRight") navigateLightbox(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, lightboxIndex, items]);

  return (
    <div>
      {/* Category filters */}
      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Gallery categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              category === cat
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-navy-50 text-navy-600 hover:bg-navy-100"
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => fetchItems(category, 1)} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-navy-50">
              <div className="aspect-[4/3] rounded-2xl bg-navy-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-navy-100" />
                <div className="h-3 w-1/2 rounded bg-navy-100" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-12 text-center">
          <p className="text-4xl mb-3">🖼️</p>
          <p className="font-medium text-navy-700">No images in this category yet</p>
          <p className="mt-1 text-sm text-navy-400">Gallery content will appear here once uploaded by the hospital.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => openLightbox(item)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-navy-50">
                  {item.file_type === "video" ? (
                    <div className="flex h-full w-full items-center justify-center bg-navy-900">
                      <span className="text-4xl">🎬</span>
                      <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Video</span>
                    </div>
                  ) : item.display_url || item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url || item.display_url || ""}
                      alt={item.title || item.caption || "Gallery image"}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  {/* Fallback for broken images */}
                  <div className="hidden absolute inset-0 flex-col items-center justify-center gap-2 bg-navy-50 p-4 text-center">
                    <span className="text-2xl">🖼️</span>
                    <span className="text-xs text-navy-400">{item.title ?? "Image"}</span>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-navy-900/0 transition-colors group-hover:bg-navy-900/20 flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-white/90 p-3 shadow-lg">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                    </span>
                  </div>
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-navy-700 shadow-sm">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </div>
                {(item.title || item.caption) && (
                  <div className="p-4">
                    {item.title && <h3 className="text-sm font-semibold text-navy-900 line-clamp-1">{item.title}</h3>}
                    {item.caption && <p className="mt-1 text-xs text-navy-500 line-clamp-2">{item.caption}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-xl border border-navy-200 bg-white px-6 py-3 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox / Full-screen viewer */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              aria-label="Previous image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          {lightboxIndex < items.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              aria-label="Next image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-4xl w-full">
            {lightbox.file_type === "video" ? (
              <video src={lightbox.display_url ?? ""} controls className="max-h-[80vh] w-full rounded-xl" />
            ) : (
              <img
                src={lightbox.display_url || lightbox.thumbnail_url || ""}
                alt={lightbox.title || "Gallery image"}
                className="max-h-[80vh] w-full rounded-xl object-contain"
              />
            )}
            {(lightbox.title || lightbox.caption) && (
              <div className="mt-4 text-center text-white">
                {lightbox.title && <p className="font-semibold">{lightbox.title}</p>}
                {lightbox.caption && <p className="mt-1 text-sm text-white/70">{lightbox.caption}</p>}
              </div>
            )}
            <p className="mt-2 text-center text-xs text-white/50">
              {lightboxIndex + 1} of {items.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
