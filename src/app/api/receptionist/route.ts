import { NextRequest, NextResponse } from "next/server";
import { handleMessage, handlePayload } from "@/lib/receptionist";
import { avatarCapabilities, avatarProviderName } from "@/lib/avatar";

export const dynamic = "force-dynamic";

/**
 * AI receptionist chat endpoint.
 * The engine answers strictly from verified clinic configuration,
 * approved FAQs and the live booking backend — it cannot fabricate
 * answers, diagnose, or prescribe.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : "anonymous";
    if (typeof body.payload === "string" && body.payload.startsWith("intent:")) {
      const reply = await handlePayload(sessionId, body.payload);
      return NextResponse.json({ ...reply, provider: avatarProviderName() });
    }
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    // Bound message size to curb abuse.
    if (body.message.length > 2000) {
      return NextResponse.json({ error: "Message too long." }, { status: 400 });
    }
    const reply = await handleMessage(sessionId, body.message);
    return NextResponse.json({ ...reply, capabilities: avatarCapabilities(), provider: avatarProviderName() });
  } catch (e) {
    console.error("[receptionist]", e);
    return NextResponse.json(
      { text: "Sorry, I'm having trouble right now. Please call the clinic or try again shortly.", state: "idle" },
      { status: 200 }
    );
  }
}
