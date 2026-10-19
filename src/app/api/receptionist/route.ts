import { NextRequest, NextResponse } from "next/server";
import { handleMessage, handlePayload } from "@/lib/receptionist";
import { avatarCapabilities, avatarProviderName } from "@/lib/avatar";
import { isLang, translate, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * AI receptionist chat endpoint.
 * The engine answers strictly from verified clinic configuration,
 * approved FAQs and the live booking backend — it cannot fabricate
 * answers, diagnose, or prescribe. Replies come back in the
 * requested language (English or Hindi).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lang: Lang = isLang(body.lang) ? body.lang : "en";
  try {
    const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : "anonymous";
    if (typeof body.payload === "string" && body.payload.length > 0) {
      // "greet" is a UI signal — respond with the avatar's introduction.
      const payload = body.payload === "greet" ? "reset" : body.payload;
      const reply = await handlePayload(sessionId, payload, lang);
      return NextResponse.json({ ...reply, capabilities: avatarCapabilities(), provider: avatarProviderName() });
    }
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: translate(lang, "rw.errorReply") }, { status: 400 });
    }
    // Bound message size to curb abuse.
    if (body.message.length > 2000) {
      return NextResponse.json({ error: translate(lang, "rw.errorReply") }, { status: 400 });
    }
    const reply = await handleMessage(sessionId, body.message, lang);
    return NextResponse.json({ ...reply, capabilities: avatarCapabilities(), provider: avatarProviderName() });
  } catch (e) {
    console.error("[receptionist]", e);
    return NextResponse.json(
      { text: translate(lang, "chat.error"), state: "idle" },
      { status: 200 }
    );
  }
}
