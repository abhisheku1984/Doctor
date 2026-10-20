"use client";
import Gallery from "@/components/Gallery";

export default function GalleryContent() {
  return (
    <div className="bg-white">
      <section className="bg-navy-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">Gallery</p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">Hospital Gallery</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-200">
            Explore our hospital infrastructure, medical facilities, events, and the dedicated team that cares for you. Images are updated regularly by our staff.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Gallery />
      </section>
    </div>
  );
}
