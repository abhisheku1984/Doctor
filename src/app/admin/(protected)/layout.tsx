import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { verifySessionValue } from "@/lib/session";
import { DemoModeBanner } from "@/components/DemoModeBanner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  // Server-side verification — never trust the frontend alone.
  const session = await verifySessionValue(cookieStore.get("drxyz_admin_session")?.value);
  if (!session?.admin) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-navy-50/50">
      <DemoModeBanner />
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="font-display text-lg font-semibold text-navy-900">
            Clinic Admin
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm" aria-label="Admin">
            {[
              ["/admin", "Dashboard"],
              ["/admin/appointments", "Appointments"],
              ["/admin/schedule", "Schedule"],
              ["/admin/integrations", "Integrations"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 font-medium text-navy-600 hover:bg-navy-50 hover:text-navy-900"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/" className="text-sm text-navy-500 hover:text-teal-700">View site</Link>
            <form action="/api/admin/logout" method="post">
              <button className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
