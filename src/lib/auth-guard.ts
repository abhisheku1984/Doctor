/**
 * Server-side authorization guards for API routes.
 * Supports both legacy admin and new user-session auth.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "./session";
import { getUserById } from "./users";
import { hasPermission } from "./rbac";

export interface AuthContext {
  session: { admin?: { username: string }; user?: { id: string; email: string; name: string; role: string; hospital_id: string | null } } | null;
  user: import("./db").User | null;
}

export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  // Try admin session
  let session = await verifySessionValue(req.cookies.get("drxyz_admin_session")?.value);
  if (session) {
    // Legacy admin => treat as super_admin
    if (session.admin && !session.user) {
      return { session, user: null };
    }
    if (session.user) {
      const dbUser = getUserById(session.user.id);
      return { session, user: dbUser };
    }
    return { session, user: null };
  }

  // Try user session
  session = await verifySessionValue(req.cookies.get("hospital_session")?.value);
  if (session?.user) {
    const dbUser = getUserById(session.user.id);
    return { session, user: dbUser };
  }

  return { session: null, user: null };
}

export async function requireAuth(req: NextRequest): Promise<{ ctx: AuthContext; error: NextResponse | null }> {
  const ctx = await getAuthContext(req);
  if (!ctx.session) {
    return { ctx, error: NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 }) };
  }
  // Check if user is suspended/inactive
  if (ctx.user && (ctx.user.status === "suspended" || ctx.user.status === "inactive")) {
    return { ctx, error: NextResponse.json({ error: "Account is suspended or inactive." }, { status: 403 }) };
  }
  return { ctx, error: null };
}

export async function requireRole(req: NextRequest, roles: string[]): Promise<{ ctx: AuthContext; error: NextResponse | null }> {
  const { ctx, error } = await requireAuth(req);
  if (error) return { ctx, error };

  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !roles.includes(role)) {
    return { ctx, error: NextResponse.json({ error: "Forbidden. Insufficient permissions." }, { status: 403 }) };
  }
  return { ctx, error: null };
}

export async function requirePermission(req: NextRequest, permission: string): Promise<{ ctx: AuthContext; error: NextResponse | null }> {
  const { ctx, error } = await requireAuth(req);
  if (error) return { ctx, error };

  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role) return { ctx, error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };

  const { hasPermission: check } = await import("./rbac");
  if (!check(role, permission as any)) {
    return { ctx, error: NextResponse.json({ error: "Forbidden. Missing permission: " + permission }, { status: 403 }) };
  }
  return { ctx, error: null };
}

export function getActorLabel(ctx: AuthContext): string {
  if (ctx.user) return `${ctx.user.email} (${ctx.user.role})`;
  if (ctx.session?.admin) return ctx.session.admin.username;
  if (ctx.session?.user) return ctx.session.user.email;
  return "anonymous";
}

export function canAccessHospital(ctx: AuthContext, targetHospitalId: string | null): boolean {
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (role === "super_admin") return true;
  if (!ctx.user?.hospital_id || !targetHospitalId) return role === "super_admin";
  return ctx.user.hospital_id === targetHospitalId;
}
