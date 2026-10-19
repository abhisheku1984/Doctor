import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionValue } from "@/lib/session";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import AdminHeader from "@/components/AdminHeader";

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
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
