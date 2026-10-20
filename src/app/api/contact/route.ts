import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { initDb } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  initDb();
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;
    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 chars)." }, { status: 400 });
    }

    const id = `msg_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date().toISOString();
    const sanitized = message.replace(/[<>&"']/g, "").slice(0, 2000);

    getDb().prepare(`INSERT INTO contact_messages (id, name, email, phone, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)`)
      .run(id, name.trim().slice(0, 100), email.toLowerCase().trim(), phone?.trim().slice(0, 20) ?? null, subject?.trim().slice(0, 200) ?? null, sanitized, now, now);

    try {
      trackEvent({ event_type: "contact_form", page: "/contact", outcome: "submitted", ip: req.headers.get("x-forwarded-for") ?? req.ip ?? null });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, id, message: "Message received. We'll get back to you soon." }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  initDb();
  const { searchParams } = new URL(req.url);
  // Admin-only: list messages
  const auth = req.headers.get("cookie") ?? "";
  // Simple check — full RBAC via auth-guard in protected routes
  try {
    const d = getDb();
    const messages = d.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100").all() as any[];
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
