# AI Receptionist / Avatar Provider Setup

## Current: local demo provider (no credentials)

The built-in provider ships with:

- A professional animated avatar (natural blinking, speaking mouth animation)
- Browser-based voice (Web Speech API `speechSynthesis`) — **no data leaves the patient's device**
- Voice input via browser speech recognition (Chrome/Edge)
- Full text chat with live booking capabilities
- Captions, mute, close, restart, and text-only fallback

This is always functional and clearly labeled. Voice quality and lip-sync are approximations of a video avatar.

## Upgrading to a realistic video avatar

The integration layer is `src/lib/avatar.ts` (`AvatarProvider` abstraction) — swap providers without touching the UI. Two supported options:

### Option A — HeyGen Interactive Avatar

1. Create a HeyGen account, subscribe to the Interactive Avatar plan.
2. Create an avatar (or use a template) and note its `avatar_id`.
3. Create an API key in HeyGen → Settings → API.
4. Set server-side:
   ```bash
   AVATAR_PROVIDER=heygen
   HEYGEN_API_KEY=your_key
   HEYGEN_AVATAR_ID=your_avatar_id
   ```
5. Implement the `speak()` adapter in `src/lib/avatar.ts` using HeyGen's Streaming Avatar SDK (server token exchange, client renders the video stream).

### Option B — D-ID Streaming Conversation

1. Create a D-ID account → API key.
2. Configure a talking avatar (image + voice).
3. Set server-side:
   ```bash
   AVATAR_PROVIDER=did
   DID_API_KEY=your_key
   ```
4. Implement the adapter using D-ID's `streaming_create` conversation API with `chat`+`voice` config.

## Privacy checklist (complete before enabling patient interactions)

- [ ] Confirm the provider's data-retention policy for patient audio/video
- [ ] Confirm commercial website embedding is permitted on your plan
- [ ] Confirm supported languages (English required; Hindi optional)
- [ ] Add the provider's privacy notice link to the receptionist panel
- [ ] Verify the provider never receives the booking reference or mobile number in voice prompts

## Voice & lip-sync notes

- With the local provider, the mouth animates while browser TTS speaks (approximated lip-sync, zero external data).
- With HeyGen/D-ID, true video lip-sync and provider voices are used; the avatar then streams from the provider's servers.
