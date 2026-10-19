import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { recentAuditLogs } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);
  return NextResponse.json({ ok: true, logs: recentAuditLogs(limit) });
}
