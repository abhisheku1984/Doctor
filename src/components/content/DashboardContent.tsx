"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  mode: string;
  service_name: string;
  doctor_id?: string;
}

interface Billing {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export default function DashboardContent() {
  const [user, setUser] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billing, setBilling] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) { window.location.href = "/login"; return; }
        const me = await meRes.json();
        setUser(me.user);

        // Fetch appointments for this user (lookup by mobile/email)
        // Use the general appointments API filtered by user's bookings
        const aptRes = await fetch(`/api/billing`);
        if (aptRes.ok) {
          const bData = await aptRes.json();
          setBilling(bData.billing ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 text-center text-navy-500">Loading your dashboard…</div>;
  if (!user) return <div className="mx-auto max-w-5xl px-4 py-12 text-center"><p>Please <Link href="/login" className="text-teal-600 underline">sign in</Link> to view your dashboard.</p></div>;

  return (
    <div className="bg-navy-50 min-h-[80vh]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome header */}
        <div className="rounded-2xl bg-navy-900 p-6 text-white sm:p-8">
          <h1 className="font-display text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="mt-1 text-sm text-navy-300">{user.email} · <span className="capitalize">{user.role.replace("_", " ")}</span></p>
          {!user.mobile_verified && user.mobile && (
            <div className="mt-4 rounded-xl bg-amber-500/20 border border-amber-400/30 p-3 flex items-center justify-between">
              <p className="text-sm text-amber-200">⚠️ Mobile number not verified</p>
              <Link href="/verify-mobile" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-navy-900">Verify now</Link>
            </div>
          )}
          {!user.mobile && (
            <div className="mt-4 rounded-xl bg-amber-500/20 border border-amber-400/30 p-3 flex items-center justify-between">
              <p className="text-sm text-amber-200">📱 Add your mobile number for appointment updates</p>
              <Link href="/verify-mobile" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-navy-900">Add mobile</Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link href="/book" className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft hover:shadow-lift transition-shadow">
            <span className="text-2xl">📅</span>
            <h3 className="mt-2 font-semibold text-navy-900">Book Appointment</h3>
            <p className="mt-1 text-xs text-navy-500">Find doctors & book instantly</p>
          </Link>
          <Link href="/appointments/lookup" className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft hover:shadow-lift transition-shadow">
            <span className="text-2xl">🔍</span>
            <h3 className="mt-2 font-semibold text-navy-900">Lookup Appointment</h3>
            <p className="mt-1 text-xs text-navy-500">View, reschedule, or cancel</p>
          </Link>
          <Link href="/gallery" className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft hover:shadow-lift transition-shadow">
            <span className="text-2xl">🖼️</span>
            <h3 className="mt-2 font-semibold text-navy-900">Gallery</h3>
            <p className="mt-1 text-xs text-navy-500">Explore hospital & facilities</p>
          </Link>
        </div>

        {/* Appointments */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy-900">My Appointments</h2>
          <div className="mt-4 rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
            <p className="text-sm text-navy-500">
              Use your appointment reference and mobile number to look up bookings, or book a new appointment.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/book" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Book Now</Link>
              <Link href="/appointments/lookup" className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50">Look Up</Link>
            </div>
          </div>
        </section>

        {/* Invoices */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-navy-900">My Invoices</h2>
            <span className="text-xs text-navy-400">{billing.length} invoice(s)</span>
          </div>
          <div className="mt-4 rounded-2xl border border-navy-100 bg-white shadow-soft">
            {billing.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-navy-400">No invoices yet. Invoices appear here after booking.</p>
              </div>
            ) : (
              <div className="divide-y divide-navy-50">
                {billing.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-mono text-sm font-medium text-navy-900">{bill.invoice_number}</p>
                      <p className="text-xs text-navy-400">{new Date(bill.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-navy-900">₹{bill.total_amount}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bill.status === "paid" ? "bg-green-50 text-green-700" : bill.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-navy-50 text-navy-500"}`}>{bill.status}</span>
                    </div>
                    <Link href={`/billing/${bill.id}`} className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium hover:bg-navy-50">View</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Profile */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy-900">Profile</h2>
          <div className="mt-4 rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-navy-500">Name</dt><dd className="font-medium text-navy-900">{user.name}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">Email</dt><dd className="font-medium text-navy-900">{user.email}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">Mobile</dt><dd className="font-medium text-navy-900">{user.mobile ?? "— not set —"}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">Role</dt><dd className="capitalize font-medium text-navy-900">{user.role.replace("_", " ")}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">Status</dt><dd><span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{user.status}</span></dd></div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
