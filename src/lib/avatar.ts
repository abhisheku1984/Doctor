/**
 * AI Receptionist avatar — provider abstraction layer.
 *
 * The website talks to this interface; the concrete provider can be
 * swapped without touching the UI:
 *   - "local"  → built-in browser demo avatar (CSS animation +
 *                Web Speech API voice). No keys, works offline.
 *                Lip-sync is approximated while browser TTS speaks.
 *   - "heygen" → HeyGen Interactive Avatar SDK (video, true
 *                lip-sync, voice). Requires HEYGEN_API_KEY + an
 *                avatar/spokesperson ID. See docs/AVATAR_SETUP.md.
 *   - "did"    → D-ID Streaming Conversation API. Requires
 *                DID_API_KEY. See docs/AVATAR_SETUP.md.
 *
 * The server NEVER exposes provider API keys to the browser.
 */
import { integrationStatus } from "./config";

export type AvatarProviderName = "local" | "heygen" | "did";

export interface AvatarCapability {
  voice: boolean;
  lipSync: boolean;
  animation: boolean;
  languages: string[];
  provider: string;
  note: string;
}

export function avatarProviderName(): AvatarProviderName {
  const p = process.env.AVATAR_PROVIDER;
  if (p === "heygen" && process.env.HEYGEN_API_KEY) return "heygen";
  if (p === "did" && process.env.DID_API_KEY) return "did";
  return "local";
}

export function avatarCapabilities(): AvatarCapability {
  const name = avatarProviderName();
  switch (name) {
    case "heygen":
      return {
        voice: true,
        lipSync: true,
        animation: true,
        languages: ["en", "hi"],
        provider: "HeyGen Interactive Avatar",
        note: "Realistic video avatar with lip sync. Patient audio/video is processed by HeyGen — review their data terms before enabling (see docs/AVATAR_SETUP.md).",
      };
    case "did":
      return {
        voice: true,
        lipSync: true,
        animation: true,
        languages: ["en", "hi"],
        provider: "D-ID Streaming Conversation",
        note: "Realistic streaming avatar. Patient audio is processed by D-ID — review their data terms before enabling (see docs/AVATAR_SETUP.md).",
      };
    case "local":
    default:
      return {
        voice: true, // browser SpeechSynthesis — no data leaves the device
        lipSync: false, // approximated mouth animation, not true lip-sync
        animation: true,
        languages: ["en", "hi"],
        provider: "Local demo avatar",
        note: "Demo avatar with browser-based voice (no data leaves the patient's device). Connect HeyGen or D-ID for full video lip-sync — integration point: src/lib/avatar.ts.",
      };
  }
}

export function integrationStatusForAvatar() {
  return integrationStatus("avatar");
}
