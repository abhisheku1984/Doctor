"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Doctor {
  id: string;
  name: string;
  title: string | null;
  speciality: string;
  qualifications: string | null;
  experience_years: string | null;
  about: string | null;
  photo_url: string | null;
  consultation_fee: number | null;
  online_fee: number | null;
  modes: string;
  status: string;
}

export default function DoctorsContent() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [speciality, setSpeciality] = useState("all");
  const [loading, setLoading] = useState(true);
  const [allSpecialities, setAllSpecialities] = useState<string[]>([]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (speciality !== "all") params.set("speciality", speciality);
      const res = await fetch(`/api/doctors?${params}`);
      const data = await res.json();
      setDoctors(data.doctors ?? []);
      // Collect unique specialities
      const specs = [...new Set((data.doctors ?? []).map((d: Doctor) => d.speciality))] as string[];
      if (specs.length > allSpecialities.length) setAllSpecialities(specs);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchDoctors(); }, []);
  useEffect(() => {
    const t = setTimeout(fetchDoctors, 400);
    return () => clearTimeout(t);
  }, [search, speciality]);

  return (
    <div className="bg-white">
      <section className="bg-navy-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">Our Medical Team</p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">Meet Our Doctors</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-200">
            Experienced specialists committed to your health. Search by specialization, check real-time availability, and book instantly.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search & filters */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doctors by name or specialization…"
              className="w-full rounded-xl border border-navy-200 bg-white py-3 pl-10 pr-4 text-sm outline-none placeholder:text-navy-400 focus:border-teal-500"
            />
          </div>
          <select
            value={speciality} onChange={(e) => setSpeciality(e.target.value)}
            className="rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
          >
            <option value="all">All Specializations</option>
            {allSpecialities.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-navy-100 p-6">
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-full bg-navy-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 bg-navy-100 rounded" /><div className="h-3 w-2/3 bg-navy-100 rounded" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-12 text-center">
            <p className="text-3xl mb-3">👨‍⚕️</p>
            <p className="font-medium text-navy-700">No doctors found</p>
            <p className="mt-1 text-sm text-navy-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doc) => {
              let modes: string[] = [];
              try { modes = JSON.parse(doc.modes); } catch { modes = ["in_person"]; }
              let quals: string[] = [];
              try { quals = doc.qualifications ? JSON.parse(doc.qualifications) : []; } catch { /* ignore */ }

              return (
                <div key={doc.id} className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft hover:shadow-lift transition-shadow">
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-100">
                      {doc.photo_url ? (
                        <img src={doc.photo_url} alt={doc.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-navy-400">{doc.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-navy-900">{doc.name}</h3>
                      {doc.title && <p className="text-xs text-navy-500">{doc.title}</p>}
                      <span className="mt-1 inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                        {doc.speciality}
                      </span>
                    </div>
                  </div>

                  {quals.length > 0 && <p className="mt-3 text-xs text-navy-500">{quals.join(", ")}</p>}
                  {doc.experience_years && <p className="mt-1 text-xs text-navy-400">{doc.experience_years} years experience</p>}
                  {doc.about && <p className="mt-3 text-sm leading-relaxed text-navy-600 line-clamp-2">{doc.about}</p>}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {modes.map((m) => (
                      <span key={m} className="rounded-full border border-navy-100 px-2.5 py-1 text-xs text-navy-600">
                        {m === "online" ? "💻 Online" : "🏥 In-person"}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      {doc.consultation_fee !== null && (
                        <p className="text-sm font-bold text-navy-900">₹{doc.consultation_fee}</p>
                      )}
                      <p className="text-xs text-navy-400">Consultation fee</p>
                    </div>
                    <Link
                      href={`/book?doctor_id=${doc.id}`}
                      className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      Book Now
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
