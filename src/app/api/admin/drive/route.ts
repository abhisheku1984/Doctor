import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-guard";
import { initDb } from "@/lib/db";
import { testDriveConnection, ensureFolderStructure, syncGalleryFromDrive, isDriveConfigured } from "@/lib/google/drive";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (!role || !["super_admin", "hospital_owner"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "test") {
    const result = await testDriveConnection();
    return NextResponse.json(result);
  }

  // Status
  const configured = isDriveConfigured();
  let driveConfig: any = null;
  try {
    driveConfig = getDb().prepare("SELECT * FROM drive_config WHERE id = 'default'").get() as any;
  } catch { /* ignore */ }

  const folders = (() => {
    try { return getDb().prepare("SELECT * FROM drive_folders ORDER BY path").all() as any[]; } catch { return []; }
  })();

  const syncLog = (() => {
    try { return getDb().prepare("SELECT * FROM drive_sync_log ORDER BY created_at DESC LIMIT 20").all() as any[]; } catch { return []; }
  })();

  return NextResponse.json({
    configured,
    driveConfig,
    folders,
    syncLog,
    message: configured ? "Drive credentials found." : "Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON with drive scope.",
  });
}

export async function POST(req: NextRequest) {
  initDb();
  const ctx = await getAuthContext(req);
  const role = ctx.user?.role ?? (ctx.session?.admin ? "super_admin" : null);
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Only Super Admin can manage Drive integration." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "ensure_folders") {
    const result = await ensureFolderStructure();
    return NextResponse.json(result);
  }

  if (action === "sync_gallery") {
    const result = await syncGalleryFromDrive();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "test") {
    const result = await testDriveConnection();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action. Use ensure_folders, sync_gallery, or test." }, { status: 400 });
}
