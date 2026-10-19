import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getConfig, reloadConfig } from "@/lib/config";
import { auditLog } from "@/lib/audit";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Centralized configuration editor — the clinic updates
 * details here without touching source code.
 * Only non-secret presentation fields are editable.
 */
const EDITABLE = ["doctor", "clinic", "booking", "services", "faqs", "avatar"] as const;

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const updates = body.updates ?? {};
  const file = path.join(process.cwd(), "config", "clinic.json");
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));

  for (const key of EDITABLE) {
    if (updates[key] && typeof updates[key] === "object") {
      cfg[key] = { ...cfg[key], ...updates[key] };
    }
  }
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  reloadConfig();
  const actor = (await (await import("@/lib/auth")).readSession(req))!.admin!.username;
  auditLog(actor, "config.updated", "clinic_config", null, Object.keys(updates).join(","));
  return NextResponse.json({ ok: true, config: getConfig() });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  return NextResponse.json({ ok: true, config: getConfig() });
}
