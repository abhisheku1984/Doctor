import { NextRequest, NextResponse } from "next/server";
import { ensureSuperAdmin, getUserByEmail } from "@/lib/users";
import { getDb } from "@/lib/db";
import { initDb } from "@/lib/db";
import { isGoogleOAuthConfigured } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

/**
 * Secure Super Admin provisioning.
 * Only works when no super_admin exists yet (initial setup),
 * OR the caller provides the correct ADMIN_SETUP_SECRET.
 * Never exposes secrets to frontend.
 */
export async function POST(req: NextRequest) {
  initDb();
  const body = await req.json().catch(() => ({}));

  // Check if any super_admin already exists
  const existing = (() => {
    try { return getDb().prepare("SELECT COUNT(*) as c FROM users WHERE role='super_admin'").get() as { c: number }; } catch { return { c: 0 }; }
  })();

  // If super_admins exist, require setup secret
  if (existing.c > 0) {
    const secret = process.env.ADMIN_SETUP_SECRET;
    if (!secret || body.setup_secret !== secret) {
      return NextResponse.json({
        error: "Super Admin already exists. Provide ADMIN_SETUP_SECRET to create additional admins.",
        hint: "Set ADMIN_SETUP_SECRET in your environment for secure provisioning.",
      }, { status: 403 });
    }
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "Super Admin").trim();
  const password = body.password ? String(body.password) : undefined;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  // Check if user already exists with different role — just promote
  const existingUser = getUserByEmail(email);

  try {
    const user = ensureSuperAdmin(email, name, password);
    const wasPromoted = !!existingUser && existingUser.role !== "super_admin";

    return NextResponse.json({
      ok: true,
      message: wasPromoted
        ? `User ${email} promoted to Super Admin.`
        : `Super Admin ${email} created successfully.`,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      existingCount: existing.c,
    }, { status: existingUser && !wasPromoted ? 200 : 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);

  // Status check — does NOT expose sensitive data
  let superAdminCount = 0;
  let superAdmins: Array<{ email: string; name: string; created_at: string }> = [];
  try {
    superAdminCount = (getDb().prepare("SELECT COUNT(*) as c FROM users WHERE role='super_admin'").get() as { c: number }).c;
    superAdmins = getDb().prepare("SELECT email, name, created_at FROM users WHERE role='super_admin'").all() as any[];
  } catch { /* table may not exist */ }

  return NextResponse.json({
    superAdminExists: superAdminCount > 0,
    superAdminCount,
    // Only show count, not emails, unless explicitly requested with setup context
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    setupRequired: superAdminCount === 0,
    hint: superAdminCount === 0
      ? "No Super Admin found. POST to this endpoint with { email, name, password } to create the initial Super Admin."
      : "Super Admin provisioned. Use Super Admin account to create Hospital Owner accounts via /api/admin/users.",
  });
}
