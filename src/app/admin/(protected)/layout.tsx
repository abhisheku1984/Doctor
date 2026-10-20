import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionValue } from "@/lib/session";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import AdminHeader from "@/components/AdminHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  // Accept either admin or user (hospital_owner/super_admin) sessions
  const adminSession = await verifySessionValue(cookieStore.get("drxyz_admin_session")?.value);
  const userSession = await verifySessionValue(cookieStore.get("hospital_session")?.value);
  const session = adminSession || userSession;

  if (!session?.admin && !session?.user) {
    redirect("/admin/login");
  }

  // Patients should not access admin
  if (session?.user && session.user.role === "patient") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-navy-50/50">
      <DemoModeBanner />
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
