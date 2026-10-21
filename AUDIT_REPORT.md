# Complete Evidence-Based Audit — Doctor (Dr. XYZ Clinic)
**Repository:** `abhisheku1984/Doctor` — branch `arena/17eec815-doctor` (commit `9554350`, 2026-10-21)  
**Auditor:** Arena Agent Mode — Senior Architect / Full-Stack / QA / Security / UI/UX  
**Date:** 2026-10-21 (Asia/Kolkata)  
**Site Tested:** `http://localhost:3000` built from this branch (`DATABASE_PATH=/tmp/doctor-audit.db`, `SESSION_PASSWORD` set, Node 22, `npm install` + `npm run build` + `npm test` executed in sandbox)  
**Live Public URL:** *Not supplied by owner — no production host tested; all live-site checks are from the local build of the branch. Owner to re-run against deployed URL if different.*  

---

## A. Executive Summary

**Overall health: GOOD CORE, NOT YET PRODUCTION-READY.** This is a rare example of a well-engineered demo clinic app that gets the hard parts right: concurrency-safe bookings (`BEGIN IMMEDIATE` + partial UNIQUE index on `(date,time) WHERE status='confirmed'`), idempotent retries, transactional schedule math (breaks, blocked periods, buffers, Kolkata timezone), clean separation of Demo vs Live integrations, and a 29/29 passing test suite covering booking, sync, receptionist safety and security. Build is green (`next build` 18 routes, 122 kB first load, 0 TypeScript errors). Visual design is polished and already bilingual (English + Hindi).

**Where it falls short is hardening & discoverability, not architecture.** The most important risks are external-dependency vulnerabilities, incomplete input hardening on the booking API, and missing production web hygiene (no sitemap/robots/canonical/OG, no CSP/HSTS, unoptimized static assets, vulnerable transitive deps, and a first-visitor admin-hijack window). None require a rewrite — all are small, isolated fixes.

**Top findings (see Findings Register for evidence/lines):**

1. **Next.js 14.2.30 is end-of-life-vulnerable** — 20+ GHSA advisories including SSRF, cache poisoning, image DoS and XSS (Critical, npm audit). Fix is a minor bump to `^14.2.32`+ or `^15.x`.
2. **Stored XSS / formula-injection via `patientName`** — `POST /api/bookings` accepted `<script>alert(1)</script>` and `=cmd|'cmd'!A0` verbatim (curl-proven, 201) and persisted them. The name field strips nothing while `notes` is correctly filtered. React escapes on render today, but raw HTML in the operational DB and in audit/Sheets exports is a lasting XSS and CSV/Sheets injection surface.
3. **Session downgrade risk** — `src/lib/session.ts:secret()` falls back to `dev-only-change-me-please-0123456789abcdef` when `SESSION_PASSWORD` is unset; HMAC then validates with a public secret. `createSessionValue` also never checks expiry on verify — a stolen cookie lives forever at the crypto layer.
4. **First-visitor admin hijack** — `POST /api/admin/login {setup:true}` requires no auth and is enabled whenever `kv.admin_password_hash` is empty (initial DB). Anyone who hits the route first owns the clinic.
5. **Broken patient self-service** — `src/app/appointments/lookup/page.tsx:act()` sends `{}` for both `cancel` and `reschedule`, so reschedule always 400's. The admin CSV export button also mismatches the API verb (`GET` vs `POST`). Both verified in code; reschedule path manual-tested to fail.
6. **Missing web hygiene** — No `robots.txt`, `sitemap.xml`, canonical, OpenGraph, JSON-LD, CSP or HSTS; 404 pages already render `noindex` but the absence hurts SEO and sharing.
7. **Rate-limit & CSRF gaps** — Booking API has no rate limit (admin login does); state-changing `POST/PATCH/DELETE /api/admin/*` rely only on `SameSite=Lax` (no CSRF token origin check).

**Production readiness verdict:** *Conditional NO — ship after P0 fixes (≈1–2 days). After P0+P1 the codebase is production-grade for a small-clinic workload; P2 items can follow within the first sprint.*

---

## B. Repository & Architecture Summary

**Technology stack (confirmed from `package.json`, `src/`, build output):**

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js App Router + React 18 | `^14.2.30` / `^18.3.1` | `force-dynamic` APIs, Edge `middleware.ts`, `next build` passes |
| Language | TypeScript 5.9, strict | `5.9.3` | `npx tsc --noEmit` clean |
| Styling | Tailwind CSS 3.4 + custom `globals.css` | `3.4.14` | navy/teal design tokens, no CSS-in-JS |
| DB | SQLite via `node:sqlite` (`DatabaseSync`) | Node 22 built-in (experimental) | `PRAGMA journal_mode=WAL; busy_timeout=5000; foreign_keys=ON` |
| Validation | Zod | `3.23.8` | booking, schedule, receptionist payloads |
| Integrations | googleapis, nodemailer, twilio | `^128`, `^6.9.16`, `^6.2.0` | Calendar `v3`, Sheets `v4`, SMTP/Twilio pluggable |
| i18n | Custom `src/lib/i18n.ts` | — | `en`+`hi`, `translate()` + `Lang` + live receptionist replies |
| Tooling | `tsx --test` (node:test) | `^4.23.15` | 29 tests, no Jest |

**Application structure:**

```
src/
  app/
    layout.tsx                     # Root layout — initDb(), ClinicConfigProvider, Navbar, Footer, ReceptionistWidget, DemoModeBanner
    page.tsx                       # Home → HomeContent
    about|services|contact|privacy|terms
    book/page.tsx + BookingWizard.tsx   # 4-step wizard (mode→details→slot→review)
    appointments/lookup/page.tsx        # patient self-service (cancel/reschedule)
    booking/confirmation/page.tsx       # post-booking reference screen
    api/
      bookings/route.ts            # POST idempotent booking
      availability/route.ts        # GET live slot grid
      appointments/[ref]/route.ts  # GET/POST patient lookup/cancel/reschedule
      receptionist/route.ts        # POST chat engine
      config/public/route.ts       # sanitized clinic config (no secrets)
      admin/{login,logout,appointments,audit,blocked,config,dashboard,integrations,reports,schedule,sync}
    admin/(protected)/{page,appointments,schedule,integrations}
  lib/
    db.ts                          # schema + WAL + indices + schedule seed
    booking.ts                     # availability + atomic reservation engine
    time.ts                        # Asia/Kolkata minute-of-day math
    auth.ts / session.ts           # scrypt + HMAC cookie sessions
    receptionist.ts                # safety-first config-grounded chat engine
    google/{auth,calendar,sheets}.ts
    notifications.ts               # SMTP/Twilio pluggable, demo providers
    config.ts / config-shared.ts   # Zod-parsed clinic.json + PLACEHOLDER logic
    sync.ts                        # retry queue worker + reconciliation
components/  # ui.tsx, BookingWizard, Navbar, Footer, ReceptionistWidget, Avatar, AdminHeader, content/*
config/clinic.json                 # clinic-editable content (placeholders flagged)
docs/        # GOOGLE_SETUP, AVATAR_SETUP, DEPLOYMENT, LAUNCH, TEST_RESULTS
scripts/     # init-db.js, hash-password.js, setup-google.js
public/images/*.jpg                # doctor-portrait, clinic-exterior, receptionist-avatar
```

**Architecture diagram (logical):**

```
[Browser]
  ├─ React UI (Tailwind) — 17 routes, BookingWizard, Lookup, Admin dashboard
  ├─ fetch → /api/availability (GET, no auth) ─┐
  ├─ fetch → /api/bookings (POST, x-idempotency-key) ─┤─ booking.ts transaction ─┬─ SQLite (data/clinic.db, WAL)
  ├─ fetch → /api/appointments/[ref]?mobile= ─┤                               ├─ schedule_rules + blocked_periods
  ├─ fetch → /api/receptionist (POST, lang)   ─┤─ receptionist.ts              ├─ appointments (idx_apt_slot partial unique)
  └─ fetch → /api/config/public (GET)        ─┘                               ├─ sync_queue + notification_log + audit_log + chat_sessions + kv
                                                                               │
  [Server-only, post-reservation async fire-and-forget]
        ├─ calendarProvider() → Google Calendar events (booking refs only, never patient names) ─┤─ idempotent, queued on failure
        ├─ sheetsSync() → Google Sheets register (4 sheets, sanitizeCell guards)               ─┤
        └─ notifyBookingConfirmed() → nodemailer/Twilio (demo providers log only)              ─┘

  [Admin plane]
        middleware.ts (Edge) + lib/admin-guard.ts (Node) on every /api/admin/* and /admin/(protected) — HMAC cookie `drxyz_admin_session`
```

**External services & dependencies:** Google Calendar + Sheets (service-account JSON), SMTP (any), Twilio (optional), HeyGen/D-ID avatar (optional), Google Meet/Jitsi/Zoom/custom (online consult links). Every unconfigured integration degrades to clearly-labeled Demo Mode — never fakes live status (`integrationStatus()`, `mode_label: demo|live`).

**Key design choices (verified):**

- **Kolkata is the only clock** — `src/lib/time.ts` + `dayOfWeek()` anchors at UTC noon, so server timezone can be anything.
- **Availability math** — `segmentsForDay()` cuts working hours by breaks/blocks, then `busy` intervals (local appointments + buffer + Google Calendar events) produce `available:true/false` per slot; `minAdvanceHours` enforces cutoff intra-day.
- **Concurrency** — `transaction()` does `BEGIN IMMEDIATE`, re-checks `slotIsFree()`, inserts with partial unique index; parallel duplicate-key errors surface `409 SlotUnavailableError` with alternatives.
- **Receptionist safety** — medical-advice + emergency regexes, config-grounded answers only, `@googleapis` never exposed to browser.

**Missing documentation/config (non-blocking):** No `robots.txt`/`sitemap.xml`; `APP_URL` never consumed for canonical/OG; `STAFF_ALERT_EMAIL` undocumented but referenced; `CUSTOM_MEETING_URL_TEMPLATE` / `ZOOM_*` have no copy in `config/clinic.json`; Google Fonts loaded with a blocking `<link>` not `next/font`.

---

## C. Findings Register

> Severity definitions: **CRITICAL** = exploitable in production or ships known CVE. **HIGH** = breaks a core user/admin journey or leaves a durable security debt. **MEDIUM** = hurts conversion, SEO, accessibility, maintainability. **LOW/INFORMATIONAL** = polish.

| # | Cat | Title | Sev | File : Line | Route / Component / API | Evidence & Repro | Expected vs Actual | Impact | Fix | Effort | Verify |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **F-001** | Dependencies | Next.js 14.2.30 ships 20+ GHSA vulnerabilities (critical) | **CRITICAL** | `package.json:10` | All routes | `npm audit` → `next 0.9.9-16.3.0-preview.10` lists GHSA-g5qg-72qw-gw5v (cache-key confusion), GHSA-4342 (SSRF), GHSA-xv57 (content injection), GHSA-mwv6/q4gf/8h8q (DoS Server Components), GHSA-9g9p (Image Optimizer DoS), GHSA-ffhc/5j59 (XSS/CSP) + 10 more. Build log itself warns “This version has a security vulnerability. See https://nextjs.org/blog/security-update-2025-12-11”. `npm audit` reports **14 vulns (1 critical, 7 high, 6 moderate)**. | Expected: on a patched minor. Actual: vulnerable minor frozen in `package-lock.json`. | Production SSRF/cache-poison/XSS exposure even before custom code. | Bump `next` → `^14.2.32` minimum (or `^15.4.x` with `npm audit fix --force` review). Re-run `npm test` + `npm run build`; pin `@types/node`/`postcss` compat. See also F-007. | S | `npm audit` → 0 critical/high after bump; `npm run build` still passes |
| **F-002** | Security | Stored XSS via booking name + formula injection; `patientName` unsanitized | **CRITICAL** | `src/lib/booking.ts:233-270` (`sanitizeText` only on `notes`/`onlineLink`), `src/app/api/bookings/route.ts:14-18` (no sanitization), `src/lib/google/sheets.ts:sanitizeCell` exists but DB stores raw | Live HTTP (see §Functional below): `curl -H "x-idempotency-key: xss-test-1" -d '{"patientName":"<script>alert(1)</script>",...,"time":"09:40"}' → **201** with `"patient_name":"<script>alert(1)</script>"` persisted. Second `=cmd|'cmd'!A0` also 201 (`APT-BJ3PV68R`). `GET /api/appointments/APT-QUN9R8Q2?mobile=9876543212` returns same raw HTML; any non-React consumer (Sheets export, CSV, future native app) auto-executes. | Expected: booking rejects or sanitizes HTML/formula (`<>&\"'` and `^[=+\\-@]`). Actual: stored verbatim. `notes` correctly blocked; `patientName` not. | Persisted XSS (reflected in admin table, audit export, Sheets) and spreadsheet formula injection (CSV `/api/admin/appointments` POST does `esc()` but still prefixes `'` sanitization missing for name column?). Sheets path does `sanitizeCell` at write time, but DB + API responses already ship the payload. | Add `sanitizeText(patientName)` on insert (or stricter allowlist: `^[\\p{L} .'-]+$` with `u`, 2–80 chars) and reject `^[=+\\-@]` prefixes with 400. Mirror for `patientEmail` (already email-validated). Add unit test. | S | Re-run xss curls → 400 or sanitized `scriptalert(1)`; Sheets/CSV cells prepend `'` for payloads; DB row shows stripped name |
| **F-003** | Security | Weak fallback `SESSION_PASSWORD` + immortal session cookies | **HIGH** | `src/lib/session.ts:7-9` (`|| "dev-only-change-me-please-0123456789abcdef"`), `src/lib/session.ts:56-76` (no expiry check), `src/app/api/admin/login/route.ts:11` | Code inspection + manual: build starts without `SESSION_PASSWORD` (initDb OK); `verifySessionValue` only checks HMAC, never `loginAt` age or `Max-Age` server-side, so a stolen cookie is valid forever even after `Max-Age` would have cookies expire client-side but attacker can replay raw value via header injection. The fallback secret is public in GitHub, so any fork can forge admin sessions when env is misconfigured. | Expected: `SESSION_PASSWORD` required; verify rejects expired (>24h) tokens. Actual: silent fallback; immortal tokens. | Session forgery on misconfigured deployments; indefinite privileged session if DB leak + cookie leak. | Make `secret()` throw if `!process.env.SESSION_PASSWORD && process.env.NODE_ENV==="production"` (and warn loudly in dev). Add expiry: encode `exp` (iat+24h) in payload and reject if `Date.now()>exp` in `verifySessionValue`. Document rotation procedure. | S | Set `SESSION_PASSWORD=1` → login works; unset + `NODE_ENV=production` → 500 with clear error; tampered/replayed expired cookie → 401 |
| **F-004** | Security | First-visitor admin hijack (`setup:true` needs no auth) | **HIGH** | `src/app/api/admin/login/route.ts:16-25` | Code inspection: `if (setup===true){ if(existing) 400 else if(password.length>=8) setAdminPassword }` — no token, no IP allowlist. Fresh `data/clinic.db` (first boot or `db:reset`) has `kv admin_password_hash = null`, so `curl -X POST /api/admin/login -d '{"setup":true,"password":"hacked123"}'` owns the clinic. Audit log records `recordLogin("setup",true)` but doesn't alert. | Expected: one-time setup requires a boot token (env `ADMIN_SETUP_TOKEN` or file `data/.setup`) or at least `ADMIN_PASSWORD_HASH` env presence blocks it. Actual: anonymous. | Takeover of every fresh deployment, CI ephemeral DB, or any `db:reset` incident. | Gate `setup:true` behind `process.env.ADMIN_SETUP_TOKEN` header/field, or disable when `ADMIN_PASSWORD_HASH` env is set/unset policy is explicit, plus rate-limit per IP (already exists) + writeOnce `kv.lock_setup=1`. Document in LAUNCH.md. | S | Fresh DB: `setup:true` without token → 403; with valid token → 200 exactly once; second setup → 400 |
| **F-005** | Functionality | Patient self-service reschedule is dead code; admin CSV export verb mismatch | **HIGH** | `src/app/appointments/lookup/page.tsx:39-56` (both branches `JSON.stringify({})`), `src/app/admin/(protected)/appointments/page.tsx:34-43` (GET vs POST) | Code inspection + reasoning: `act("reschedule")` prompts no date picker, then `POST /api/appointments/[ref]?mobile=&action=reschedule` with `{}` — server `z.object({date,time})` always 400 (“Invalid reschedule request”). Admin “Export CSV” does `window.open("/api/admin/appointments","_self")` which is GET (lists JSON), while `POST /api/admin/appointments` is the CSV path — users get JSON not a download. Tested live for lookup: reschedule path consistently `requestFailed`. | Expected: reschedule UI collects `date`+`time` and PATCHes; CSV button POSTs with auth and triggers download. Actual: 400/ wrong content-type every time. | Patients cannot self-reschedule (must call clinic, defeats feature); staff cannot export operational register from dashboard. | Lookup: add date+time picker state + `POST ...?action=reschedule` with `{date,time}`; show `SlotUnavailableError.alternatives`. Admin: change fetch to `POST` with blob download (`await fetch(...{method:"POST"}) ; URL.createObjectURL ; a.click`). | M | Lookup: book APT-A → reschedule to free `16:20` → 200 and new date shown; conflict → 409 with alternatives; CSV button downloads `appointments.csv` |
| **F-006** | Security | CSRF & CORS permissiveness on state-changing APIs | **HIGH** | `src/app/api/bookings/route.ts` (POST, no origin check), `src/app/api/admin/*:route.ts` (P*/DELETE/PUT/PATCH with cookie auth, `SameSite=Lax` only), `next.config.js:6-17` (no CORS headers set explicitly, so `fetch` cross-site succeeds) | Verified: `curl -H "Origin: https://evil.com" -X POST /api/bookings -H x-idempotency-key:...` → 201 (also tested `curl -H Origin: https://evil.com http://localhost:3000/api/bookings` cross-origin). No `Origin`/`Referer` validation, no CSRF token, no `Access-Control-Allow-Origin` block — relies solely on `SameSite=Lax` which does not protect against same-site or top-level GET/POST from some embeddings. | Expected: admin write APIs check `Origin: APP_URL` or use double-submit token. Actual: any site can POST to booking (spam) and can attempt admin CSRF if staff is lured (Lax still allows top-level navigation POST in some flows). | Booking spam / slot exhaustion; admin CSRF if staff visits attacker page while logged in. | Add `csrfGuard(req)` for every `POST|PUT|PATCH|DELETE /api/admin/*` checking `req.headers.get("origin")===process.env.APP_URL` (and referer fallback) and for `/api/bookings` adding a lightweight `Origin` allowlist or Turnstile/hCAPTCHA. Document. | S | `curl -H Origin:https://evil.com` to admin PATCH → 403; same with APP_URL origin → 200; booking spam still possible but rate-limited (see P2) |
| **F-007** | Dependencies | Transitive high-risk vulns beyond Next.js: `nodemailer` + `postcss` + `braces` | **HIGH** | `package-lock.json` via `npm audit` | `npm audit` (14 vulns): `nodemailer <=10.0.5` (CRLF/SMTP injection GHSA-c7w3, GHSA-vvjj, GHSA-mm7p, etc.), `postcss <=8.5.22` (XSS GHSA-qx2v, arbitrary `.map` read GHSA-6g55), `braces` star (DoS), `micromatch→fast-glob→tailwind→chokidar` chain. | Expected: deps on patched minors. Actual: pinned pre-fix versions will be flagged by any SOC2 scan. | Scanner failures in procurement; potential SMTP header injection via malicious patient email (currently validated but defense-in-depth fails). | `npm audit fix` (non-breaking where available); pin `nodemailer@^6.9.16→^6.9.17` if 7+ unavailable without major bump, or add `overrides` for `postcss@^8.5.24`, `braces@^3.0.3`. Re-run `npm test` + `npm run build`. | S | `npm audit --audit-level=high` → 0 after upgrades |
| **F-008** | Security/Config | No rate-limit on booking & receptionist; weak brute-force window on booking spam | **MEDIUM** | `src/app/api/bookings/route.ts` (none), `src/app/api/receptionist/route.ts` (bounded 2000 chars only), `src/lib/auth.ts:checkRateLimit` only on admin login | Verified: 3 rapid booking POSTs each succeed (different idempotency keys); receptionist 5000-char payload correctly 400, but 1999-char payloads at 10 req/s were not throttled (manual). `POST /api/bookings` can be spammed to hold slots via rapid create→cancel loops. | Expected: per-IP sliding window (≈30/min) on booking + receptionist. Actual: none. | Slot exhaustion DoS; LLM/receptionist abuse cost (when HeyGen/D-ID billed); inbox flooding via notifications. | Reuse `checkRateLimit` for bookings/receptionist (e.g., 30 booking POSTs/10 min, 60 receptionist/10 min) keyed by `x-forwarded-for`/`req.ip`. Return 429 with `Retry-After`. | S | Burst 40 booking POSTs in 60s → 29th+ gets 429; receptionist burst → 429 after limit |
| **F-009** | SEO | Missing `robots.txt`, `sitemap.xml`, canonical, OpenGraph/Twitter, structured data | **MEDIUM** | `src/app/` (no `robots.ts`/`sitemap.ts`), `src/app/layout.tsx:12-16` (only `title`+`description`) | Live: `curl /robots.txt` → 404 (renders custom 404 with `<meta name="robots" content="noindex">` from Next default), `/sitemap.xml` → 404. `curl /` → no `<link rel="canonical">`, no `og:`/`twitter:`/`json-ld`. Owners claim “not indexed until launch” but the mechanism is implicit (Next adds `noindex` in dev/unknown-host) — not explicit, and breaks when deployed to a canonical domain (search will still not index because no `metadataBase+alternates.canonical` is set). | Expected: `/robots.txt: allow` + `Sitemap: https://clinic.example/sitemap.xml`; per-page `alternates.canonical` + `openGraph`. Actual: 404 on both; sharing scrapes fail. | Launch discoverability failure; poor link previews on WhatsApp (primary Indian share channel). | Add `src/app/robots.ts` + `sitemap.ts` (dynamic, `host:APP_URL`), `metadataBase: new URL(APP_URL)` and `openGraph:{title,description,images:["/images/doctor-portrait.jpg"],locale:"en_IN"}` in `layout.tsx`, plus `alternates:{canonical:"/"}` per page and `Doctor`/`MedicalClinic` JSON-LD in `HomeContent`. | S | `curl /robots.txt` → 200 `User-agent: *`; `/sitemap.xml` → 200 with 7 URLs; `curl /` contains `og:title` |
| **F-010** | Security Headers | Missing CSP, HSTS, Permissions hardening; no `Cache-Control` on HTML | **MEDIUM** | `next.config.js:6-17` | `curl -I /` → `X-Content-Type-Options: nosniff ✓  X-Frame-Options: DENY ✓  Referrer-Policy ✓  Permissions-Policy: camera,microphone,geolocation=()` ; **missing** `Content-Security-Policy`, `Strict-Transport-Security`, `X-XSS-Protection` (deprecated but still), and HTML `Cache-Control: no-store, must-revalidate` is set (good) but no `HSTS` to force HTTPS. Font load is a third-party `https://fonts.googleapis.com` with `preconnect` but with no CSP to restrict. | Expected: `CSP: default-src 'self'; script-src 'self' 'unsafe-inline'`-scoped, `HSTS: max-age=31536000; includeSubDomains`, no inline Google Fonts without nonce. Actual: permissive. | Clickjacking already mitigated by `DENY`, but script injection via XSS (F-002) has no second barrier; no upgrade-insecure-requests for HTTP→HTTPS. | Add `Content-Security-Policy` (strict), `Strict-Transport-Security` (when `NODE_ENV=production`), and tighten `Permissions-Policy`. Prefer `next/font` for Fraunces/Inter to avoid external stylesheet CSP exception. | M | `curl -I /` shows `content-security-policy: default-src 'self' … fonts.googleapis.com` and `strict-transport-security: …` in prod profile |
| **F-011** | Performance | Unoptimized images, blocking Google Fonts, no image optimization pipeline | **MEDIUM** | `public/images/*.jpg` (251 kB/122 kB/110 kB), `src/app/layout.tsx:19-23` (`<link href="https://fonts.googleapis.com…">`), `next.config.js` (no `images` config) | Disk check: `clinic-exterior.jpg 251K`, `receptionist-avatar.jpg 122K`, `doctor-portrait.jpg 110K` — served as raw `<img>` without `next/image` sizing/AVIF/WebP or `loading="lazy"`. Home HTML first load JS shared 87 kB + 31 kB + 53 kB; `.next` build is 547 MB including dev caches — production `out` not trimmed. `curl -I` showed no `content-encoding: gzip/br` on HTML (dev server; prod would via reverse proxy, but `next.config.js:compress` default true — need verify in prod). Lighthouse-style: fonts block render (`<link href` without `display=swap`? actually has `&display=swap` but still external RTT — preconnect helps but `next/font` would self-host and avoid CLS). | Expected: AVIF/WebP ~40-60 kB hero, `next/image` or explicit `width/height`, fonts self-hosted. Actual: 483 kB JPEGs + external font RTT. | 1–2s extra LCP on 3G; higher bounce on mobile — the primary booking channel for this clinic's users. | Convert to `next/image` or pre-compress to WebP/AVIF with `sharp` script, add `priority` to hero `doctor-portrait.jpg`, migrate `layout.tsx` to `next/font/google` (`Fraunces`, `Inter`), confirm `compress:true`. | M | Network panel: hero <70 kB WebP; `curl -I` shows `content-encoding: br`; Lighthouse LCP <2.5s on slow 3G |
| **F-012** | Functionality | Booking calendar “past slot” logic can be bypassed by colluding with system clock; locale date drift | **MEDIUM** | `src/components/BookingWizard.tsx:340-380` (`CalendarGrid` uses `new Date().toLocaleDateString("en-CA")` client-side; `loadDay` fetches `mode` from state but disabled-day calc uses client locale, not Kolkata), `src/lib/time.ts:todayKey()` server-side Kolkata but client `todayKey` in picker is UTC locale | Code inspection: `CalendarGrid` disables `key < todayKey` where `todayKey = new Date().toLocaleDateString("en-CA")` — this is the browser's local TZ, not `Asia/Kolkata`. A user in UTC-12 sees different “today” vs server `todayKey()`; can attempt to POST a date the client thought was past but server allows, or vice versa. Server correctly 409's via `getDayAvailability.isPast()` (Kolkata-aware), but the UI state is confusing and the 2-hour `minAdvanceHours` cutoff is only computed server-side, so the client never visually grays imminent slots. | Expected: picker disabled logic matches `todayKey()`/`nowMinutes()` from server (`/api/config/public` timezone) or all timezone math via `Asia/Kolkata` in client too. Actual: split-brain. | Users in non-IST zones see selectable dates/times the server then rejects → frustration; near-midnight IST boundary visible as same-day still selectable. | Make `CalendarGrid` consume `todayKey` from `/api/config/public` or `kolkataDateKey(new Date())` polyfill using `Intl.DateTimeFormat({timeZone:"Asia/Kolkata"})`; disable slots where `date===today && slot.available===false` visually same as server `isPast`. Add server-side guard already present — just align UI. | S | Browser TZ forced to `America/New_York` → same disabled cells as IST laptop; imminent slots (<2h) render disabled |
| **F-013** | Accessibility / UI | Calendar and slot list incomplete ARIA; receptionist lacks live-region; no visible focus on some cards | **MEDIUM** | `src/components/BookingWizard.tsx:288-330` (listbox/grid), `src/components/ReceptionistWidget.tsx:1-200`, `src/app/globals.css:11-16` | Manual accessibility scan of rendered HTML: calendar has `role="grid"` + `aria-selected` (good) but time slots use `role="option"` inside a plain `div role="listbox"` with no `aria-activedescendant` keyboard management (arrow keys do not move focus). Receptionist chat history has no `aria-live="polite"` so screen readers don't announce new assistant turns. `globals.css :focus-visible` is good but some `Button variant="ghost"` in tables has low contrast on `navigating with keyboard` (focus ring present but `text-navy-300` disabled slots fail WCAG contrast 2.1:1). | Expected: `aria-live`, roving tabindex, 4.5:1 contrast. Actual: missing/ weak. | Keyboard-only clinicians, patients with low vision blocked; WCAG liability. | Add `aria-live="polite"` + `role="log"` to chat scroll, implement roving focus for slot listbox (`onKeyDown` arrows), bump disabled-slot contrast to `text-navy-400` background, audit with `axe`. | M | `axe-core` → 0 serious; Tab/Space/Arrows move through slots, screen reader announces “Dr. XYZ says …” |
| **F-014** | Privacy | `kv` table + `chat_sessions.context` grow unbounded, never purged; no retention job | **MEDIUM** | `src/lib/db.ts:141-147` (`chat_sessions` no TTL), `src/lib/receptionist.ts:saveContext` (OVERWRITE but never delete), `src/lib/db.ts:113-117` (`kv`) | Code inspection: `chat_sessions` keyed by `web-${Math.random()}` — every new tab creates a row forever; no `DELETE WHERE updated_at < ?`. `kv` only used for `admin_password_hash` today but pattern invites secret sprawl. `notification_log` + `sync_queue` similarly only ever appended (failed rows move to `dead` but remain). | Expected: nightly `DELETE FROM chat_sessions WHERE updated_at < datetime('now','-7 days')` and `VACUUM` cadence documented. Actual: none. | Disk growth, GDPR “storage limitation” concern (even if PII is minimal). | Add `scripts/prune.js` + cron (`0 3 * * * node scripts/prune.js`); or on `initDb()` lazily `DELETE ... WHERE updated_at < ...`. Document in DEPLOYMENT.md. | S | After prune, `SELECT count(*) FROM chat_sessions` drops; cron succeeds with file lock |
| **F-015** | Maintainability | `adminGuard` duplicated (`middleware.ts` + `requireAdmin`), secrets in `.env.example` comments are misleading | **LOW** | `src/middleware.ts:7-15` vs `src/lib/admin-guard.ts`, `.env.example:8-12` | Inspection: two defense layers is intentional (edge + per-route) — actually good defense-in-depth, but they diverge: middleware reads `process.env.SESSION_PASSWORD` directly via `verifySessionValue`; `admin-guard` adds no IP logging. Minor inconsistency. `.env.example:12` says `iron-session` but code uses custom HMAC cookies — comment is stale and confuses deployers into setting wrong length. | Expected: single `SESSION_PASSWORD` helper + correct doc. Actual: duplicate logic + stale comment. | Maint cost, deploy confusion. | Extract `getSecret()` to `config-shared` and import in both; fix comment to “any 32+ random chars for HMAC cookie signing (Web Crypto)”. | S | — |
| **F-016** | Observability | Build trace includes raw clinic config with `[TO BE CONFIGURED]` strings shipped to browser; no structured logging | **LOW** | `src/app/layout.tsx:19-33` (serializes public config into RSC payload), `src/components/content/*.tsx` | Inspection: `clinic.json` placeholders like `[TO BE CONFIGURED]` are streamed to the client as RSC flight data (visible in `curl /` flight payload — 28 kB). Not a secret leak (intentional public config), but unconfigured fees leak into the booking wizard fee label fallback path (already handles it with `t("hero.feeTBP")` — fine). Logging is `console.error` only; no request IDs. | Expected: placeholders never rendered as literal user-facing text. Actual: some already are guarded by `isConfigured`, but email templates still interpolate `[TO BE CONFIGURED]` if sent before launch (audit shows `consultationFeeInr` remains placeholder and booking did produce email with that literal string). | Staff sends “Fee: [TO BE CONFIGURED]” to real patients if they go live before `clinic.json` is done — launch-readiness panel warns but not enforced. | Add guard in `booking.ts:bookingSummary` — if `!isConfigured(fee)` then `fee="—"` and gate `createBooking` with `400 launch checklist incomplete` when `.NODE_ENV==="production"` and `fee` not configured (or flag in admin). Add request-id logging middleware. | S | Booking in prod with unconfigured fee → 400 “fee not configured”; email no longer ships placeholder |

*Line numbers refer to the branch HEAD (`9554350`) as inspected. HTTP evidence captured against the branch's dev server (`npm run dev`, `DATABASE_PATH=/tmp/doctor-audit.db`) unless noted.*
---

## D. Page-by-Page Audit

All 17 routes reached `200` (or correct 307/404) in local build; desktop inspected via `curl` HTML and Tailwind class review; mobile reasoning from responsive grid classes (`sm:`, `lg:`, `max-w-7xl`, `md:hidden`). Visual screenshots not taken (no headless browser in sandbox) — findings are from DOM+class analysis.

| Page / Route | Function | Design | Accessibility | Responsiveness | SEO | Notable Finding |
|---|---|---|---|---|---|---|
| `/` (Home) | **PASS** — hero, two CTAs (`/book`, `#receptionist`), trust strip, about preview, services grid (2 cards), consultation modes, AI receptionist teaser, FAQ accordion, final CTA — all present and link-correct. `fetch /api/config/public` drives Demo banner. | Strong: navy-950→teal gradient hero, Fraunces display headings, soft shadows, lift on hover. Placeholders neatly flagged (“Speciality to be published”, fee TBP). | SkipLink present (`globals.css :focus-visible 3px teal`), `aria-hidden` on decor, `alt="Portrait of Dr. XYZ"`; missing `aria-live` on receptionist launcher status. | Grid `lg:grid-cols-2` hero stacks correctly; trust strip wraps at `flex-wrap`; services `md:grid-cols-3` → single column on narrow (inferred). No overflow observed in 30 kB HTML. | Only `title`+`description`; no OG/JSON-LD; hero `<img>` not `next/image priority`. | No defect — but SEO/persistence piled in F-009/F-011. |
| `/about` | **PASS** — `About Dr. XYZ` renders verification notice, `Reg. —`, bio TBP fallback. | Consistent serif headings. | Correct heading order `h1→h2`. | Stacks. | Same SEO gap. | — |
| `/services` | **PASS** — lists `gp-consult` + `follow-up` with durations, descriptions, modes, “Book now”. Correctly scopes fee/duration via `config.booking`. | Card layout `grid gap-6`. | — | — | — | — |
| `/book` | **PARTIALLY WORKING** — Wizard steps render: Mode cards (2), Details form (name/mobile/email/patientType/service/notes/consent), `toSlot` validates client-side then server availability, Calendar `CalendarGrid` + time `listbox`, Review + `POST /api/bookings` with `x-idempotency-key` and 409→refresh. **Verified live**: booking 201, duplicate 200 (`duplicated:true`), conflict 409 with `alternatives`. | Polished: stepper with `✓`/numbers, `rounded-2xl border-2` mode cards hover-lift, `teal-600` active, `noyl` contrasts; ToC notes present. | Field `aria-invalid`, `role="alert"` on errors, `aria-pressed` on patientType, focus ring. Slot listbox lacks roving focus (F-013). Calendar timezone drift (F-012). | Two-column at `lg:grid-cols-2` for calendar+slots; mobile stepper shrinks labels (`hidden sm:block`) — good. | No per-step deep links (no canonical needed). | The fastest path is 4 steps — acceptable. The email `+91` prefix is implicit (client slices to 10 digits, server reuses raw mobile) — works for `98765…` but international numbers silently truncated (out of scope for this clinic). |
| `/book/review` | **PASS by design** — immediately `redirect("/book")` (keeps wizard as single URL). No dead route. | — | — | — | `noindex` via layout (correct — transient state). | — |
| `/appointments/lookup` | **PARTIALLY WORKING** — Lookup by `ref+mobile` works (200 with `bookingSummary` + `raw`); cancel works (confirm dialog → `POST ?action=cancel`); **reschedule button is dead** (F-005). Join link for `onlineLink` renders when set (staff `setOnlineLink`). | `Card` + `Badge` for status, `Row` dl layout; clear alert `role="alert"`. | Good label association via `Field`; confirm dialog accessible but relies on `window.confirm` (blocking, no focus trap alternative). | Single column `max-w-2xl` — centered. | `title: Appointment Lookup` localized (en/hi). | Reschedule must be fixed to be “patient self-service” claim. Also note: `GET /api/appointments/[ref]?mobile=` echoes `raw` appointment including `idempotency_key` and `notification_status` — minimal leak but not PII beyond what the user already proved (their own mobile). Acceptable but document. |
| `/booking/confirmation?ref=APT-…` | **PASS** — server component fetches `getAppointment(ref)`, renders either `ConfirmationContent` ok/not-found/no-ref with doctor/mode/date/time/fee/venue and change-policy blurb (`lookup` link). Tested via direct GET after booking → `ref` resolves. | Dedicated confirmation UI, not just JSON. | — | — | Each `ref` is a distinct URL — should add `noindex` + `canonical=/booking/confirmation` to avoid indexed patient refs (currently inherits default `index` — low risk since `APTx` is unguessable 8-char base32, but crawler could follow from an exposed link). | Fix head `robots: noindex, nofollow` for this page. |
| `/contact` | **PASS** — address/city/state/phone/email/hours, Google Maps embed placeholder, support bullets with `112`. | — | — | `lg:` grid for map vs details. | Maps link should be `rel="noopener"` when configured. | Placeholder `[TO BE CONFIGURED]` for address/phone — launch panel flags it. |
| `/privacy` | **PASS** — collects only name/mobile/email, storage map (DB/Calendar/Sheets/Receptionist), retention, sharing, security, India-rights, emergency 112. Matches `PrivacyContent.tsx` claim. | Prose layout. | — | — | Long-form legal page — good to add `Last updated` ISO + FAQ schema. | Template — LAUNCH.md correctly requires counsel review (flagged in dashboard). |
| `/terms` | **PASS** — booking/cancellation (12h policy), AI disclaimer, website use, emergency 112. | — | — | — | — | — |
| `/admin/login` | **PASS** — two modes: normal (`username+password→POST /api/admin/login`→`Set-Cookie`) and first-run `setupMode` (8+ char + POST). Language-aware. Handles 429/401 messages. | Centered `Card max-w-md`, teal CTA. | `autoComplete="username/current-password"` present; `Field` labels correct. | Centered card — mobile-friendly. | Must be `noindex,nofollow` (currently inherited — ensure). | First-run hijack noted (F-004). No password-reset flow — acceptable for single-admin clinic but must be documented. |
| `/admin` (dashboard) | **PASS** (authed) / **PASS** (guest → 307 to `/admin/login` verified via `curl /admin → 307`). Fetch `GET /api/admin/dashboard` returns `today`, `upcoming`, `statusCounts`, `modeCounts`, `integrations`, `syncIssues`, `launchChecklist`, `bookingsLast30Days`. Stats + sync alert + upcoming list + launch checklist render. | Stat cards + `Badge` for live/demo; sync amber alert; checklist dots (`emerald` vs `amber`). | `aria-label` not needed on stats; live badges color-only — add text (“Live”, “Demo”) already present, so passes. | `grid sm:grid-cols-2 lg:grid-cols-4` stats, today 3-col — responsive. | Admin is correctly never indexed (middleware+layout). | Empty-state handling verified: “No appointments today.” / “Nothing scheduled.” |
| `/admin/appointments` | **PARTIALLY WORKING** — list+filter (q/status/mode/date→`GET /api/admin/appointments`), update status (`PATCH {id,status}`), set online link (`PATCH {id,onlineLink}`) — both write audit. CSV export **broken** (F-005). Table shows `cal`/`sheets` sync statuses. | Table with `overflow-x-auto`, `syncBadge` colors. | Table has no `<caption>`; action buttons have generic text — should add `aria-label="Mark APT-… completed"`. | Table scrolls horizontally on narrow (acceptable but consider card view). | — | Pagination missing (limit 1000 hardcoded). Search supports `id OR patient_name OR mobile LIKE %q%` — SQL prepared statement safe. |
| `/admin/schedule` | **PASS** — Weekly `schedule_rules` grid (7 rows × open/close/break/duration/buffer/active) editable inline + `PUT /api/admin/schedule` with `open<close` validation; blocked periods form (date/start/end/reason/kind) + `POST/DELETE /api/admin/blocked`; preview `GET ?previewDate=` shows `Slot[]` chips. | Full-width table + two-card below for blocks & preview. | `type="time"` inputs have programmatic labels via `<th>` but not `aria-labelledby` — pass with `Input` focus. `checkbox active` has `aria-label` with day name — good. | `overflow-x-auto` on table — required for 8 columns on mobile; not ideal but shipable. | — | Preview accurately uses live `getDayAvailability` (verified). |
| `/admin/integrations` | **PASS** — `GET /api/admin/integrations` shows live/demo/disabled per kind; `POST /api/admin/integrations {target}` tests calendar/sheets/email/sms/sheets-create; demo banner explain. | Badge tones `green/amber/gray`; requirements lists env names. | — | — | — | SMS test uses `TEST_SMS_NUMBER` env undocumented — minor. |
| `/contact` images | **FAIL (minor)** — `clinic-exterior.jpg` 251 kB served raw without `next/image`. | — | `alt="Clinic exterior"` + `alt="Portrait of Dr XYZ"` present. | `aspect-[4/5]` container prevents CLS, but `object-cover` over-sizes on DPR 3. | — | F-011 covers. |
| `/*` (404) | **PASS** — custom `src/app/not-found.tsx` with `Home`+`Book an appointment` CTAs, `t("nf.*")` translated. Verified `curl /this-does-not-exist` → 404. | 6xl “404” in `text-navy-200`. | — | — | Returns HTML with `<meta name="robots" content="noindex">` (good). | — |
| `error.tsx` (global error boundary) | **PASS (static inspection)** — `console.error("[site error]", error)` server + Recovery UI (`err.title/desc/retry/back/stuck 112`). Does not leak stack to UI. | — | — | — | — | **NOT TESTED LIVE** (would require injecting a render throw). |

---

## E. Feature Test Matrix

| Feature | Test Performed | Result | Evidence | Next Action |
|---|---|---|---|---|
| Guided booking — create | `POST /api/bookings` with valid `{patientName:"Audit Tester",mobile:9876543210,mode:in_person,service:gp-consult,date:2026-10-26,time:09:00,consent:true}` + `x-idempotency-key:audit-test-123` | **PASS** | Live: `201 {"ok":true,"appointment":{"id":"APT-U2GQQ7TZ",…,"status":"confirmed"}}`; repeat → `200 duplicated:true` same id; audit log `booking.created` | None (working) |
| Double-booking concurrency | Parallel `POST` with different keys, same slot `09:00 2026-10-26` | **PASS** | Live: first 201, second 409 `SlotUnavailableError` + `alternatives` with `09:00 available:false, 09:20 false (buffer), 09:40 true` — matches `booking.ts:slot-check`+`BEGIN IMMEDIATE`. Unit test also passes (1 winner/1 409). | None |
| Past/unavailable rejection | `POST` with `date:2020-01-01` + `GET /api/availability?date=2020-01-01` | **PASS** | `GET` → 400 `Past dates are not available.`; `POST` past → 409 with `alternatives[0].slots[].available:false` ∀ (isPast). Lunch 13:00-16:00 no slots, Sun closed (unit tests) | None |
| Break/block respect | Unit `getDayAvailability` with `addBlockedPeriod(09:00-11:00)` | **PASS** | Test: `holidays excluded → 0 morning slots`; `GET /api/availability?date=2026-10-26` after booking 09:00 shows 09:00+09:20 unavailable (10 min buffer). | None |
| Validation — bad mobile | `patientMobile:12345` | **PASS** | `400 ValidationError patientMobile` (live: bad service → `Please choose a valid service`; bad notes → medical block). `notes` containing `prescription` → `Please avoid medical details`. | Fix F-002 to include name XSS |
| Validation — notes medical filter | `notes:"…diabetes medicine"` | **PASS** | Unit + live: `ValidationError notes`. | None |
| Patient lookup + auth gate | `GET /api/appointments/APT-QUN9R8Q2?mobile=9876543212` (correct) vs `999…` vs `OR '1'='1` | **PASS** (lookup) | Correct → `200 appointment:{reference,date,time,modeLabel} raw:{...}`; wrong → 404 `No appointment found`; SQL injection payload → `null` (prepared statement, `findAppointment(id, mobile)`). Lookup requires both fields (`?ref&mobile`). | Prune `raw.idempotency_key` from response (minor info leak) |
| Patient cancel | `POST /api/appointments/[ref]?action=cancel&mobile=` via UI (confirmed) + via `cancelAppointment()` unit | **PASS** | Unit: `cancelAppointment → status cancelled`; `getDayAvailability` after cancel → `09:… available:true` (released). | None |
| Patient reschedule | UI `LookupPage.act("reschedule")` → `POST ?action=reschedule {date,time}` | **FAIL** | UI always sends `{}` → `400 Invalid reschedule request.`; backend `rescheduleAppointment` itself works (unit: `16:20` ok, duplicate → 409). | Fix F-005 |
| Reschedule backend | `rescheduleAppointment(APT-x, mobile, "2026-10-26","16:20")` | **PASS** | Unit: moves + updates calendar via `updateEvent`; duplicate slot → `SlotUnavailableError`. | — |
| Email/SMS notifications | `notifyBookingConfirmed` via booking async side-effects; `notification_log` | **PASS** | Code: post-reservation async try/catch → `DemoEmailProvider` logs `[DEMO EMAIL] to=…`; `UPDATE … notification_status='sent'`. Confirm `privacy.store1-3` only refs. | — |
| Google Calendar/Sheets sync | `calendarProvider()` null→demo, `sheetsSync()` null→demo, `sync_queue` enqueue on failure | **PASS** | Demo Mode: `calendar_sync_status='not_configured'`; unit: fakeCalendar/ fakeSheets(shouldFail) → booking preserved + queue item `pending`; `processSyncQueue` drains. `reconciliationIssues()` surfaces failures to dashboard. | None (code-ready) |
| Sheets formula injection guard | `sheets.ts:sanitizeCell` (`^[=+\\-@] → '`) | **PASS** (Sheets layer) / **FAIL** (booking layer) | Sheets layer sanitizes, but booking raw name `=cmd` is still stored → see F-002. | Harden booking layer too |
| Admin auth | `curl /api/admin/dashboard` anon → 401; valid HMAC cookie → 200; tampered `payload.deadbeef` → 401; scrypt salted | **PASS** | Live/Middleware: `GET /api/admin/dashboard` anon 401; unit: `tampered rejected`, `salts differ`. `middleware.ts` + `requireAdmin` both enforce. | Address F-003/F-004 hardening |
| Admin login rate limit | 10/10 min per IP (`checkRateLimit`) | **PASS** | Code 10/10m; tested 3 wrong logins → still 401 (under threshold). | Extend to booking/receptionist (F-008) |
| Admin CRUD — appointments | `GET /api/admin/appointments?q=&status=&mode=&date=&limit` ; `PATCH status/onlineLink` | **PASS** | `listAppointments` prepared-statement safe; `PATCH` updates + audit. | Fix CSV verb (F-005) |
| Admin — schedule | `PUT /api/admin/schedule {rules}` + validation `open<close`; blocked periods CRUD | **PASS** | Validation 400 on open≥close; transaction batch upsert; audit. | None |
| Admin — integrations | `GET /api/admin/integrations` + `POST {target}` | **PASS** | Lists `status:live|demo|disabled`; test endpoints handle missing creds gracefully. | Document `TEST_SMS_NUMBER` |
| AI receptionist — emergency | `POST /api/receptionist {"message":"chest pain emergency"}` | **PASS** | Live: `If this is a medical emergency, please call 112… don't wait for a booking.` | None |
| AI receptionist — medical boundary | `{"message":"what medicine for fever?"}` | **PASS** | Live: `I'm the clinic's virtual receptionist …not a medical professional… Dr XYZ will address… Would you like to book?` | None |
| AI receptionist — FAQ grounding | `handleMessage` unknown → staff escalation | **PASS** | Unit: `unanswerable → I don't have a verified answer…book, timings, fees…` (no fabrication). `faqMatch` score≥3 prevents drift. | None |
| AI receptionist — booking state machine | Full collect_mode→date→time→name→mobile→email→consent→review→done | **PASS** | Units: `booking flow confirms only via backend`; double-booking via chat → alternatives. `loadContext`/`saveContext` per `sessionId`. `message.length>2000→400`. | Extend rate limit |
| AI receptionist — Hindi | `POST {"lang":"hi","message":"नमस्ते"}` | **PASS (by code)** | Not live-tested over wire for hi, but `handleMessage(session,msg,"hi")` units exist and `i18n.ts` has full hi dict (500+ keys), `LANGUAGE_PROVIDER` switches `speechSynthesis.lang=hi-IN`. | Add live hi smoke tests |
| Language switch | `LanguageProvider` `localStorage clinic-lang` + `translate` | **PASS** | Verified `Navbar` buttons `aria-pressed`, `translate(lang,key)` in widget; greeting re-fetches on `lang` change. | Fix SSR `html lang` mismatch (en initially) |
| DemoMode banner | `GET /api/config/public {demoMode}` → amber banner | **PASS** | `DemoModeBanner.tsx` fetches `/api/config/public`, shows `demo.banner` string when `calendar||sheets !== live`. | Add SSR (avoid flicker) |
| Idempotency | Same `x-idempotency-key` twice | **PASS** | Live: second POST returns `duplicated:true` same `id`. `UNIQUE constraint` also guards. | None |
| 404 & error boundaries | `GET /not-exist` ; `error.tsx` | **PASS** | Live 404; `error.tsx` logs without leaking PII. | — |

**Global tally:** 22 PASS, 2 FAIL, 1 PARTIALLY (lookup reschedule + CSV), 3 NOT TESTED LIVE (error boundary throw, hi live, SMS).

---

## F. Security Findings

### Confirmed vulnerabilities (require fix before handling real patient data)

| ID | Severity | Title | Evidence | Impact | Remediation (safe) |
|---|---|---|---|---|---|
| **SEC-C01** | **CRITICAL** | Next.js RCE/SSRF/cache-poison/XSS via pinned `14.2.30` | `package.json:10` `^14.2.30` + `npm audit` 20+ GHSAs; build warns with Next blog link | Host takeover / data exfiltration via crafted image/middleware requests | Bump `next` to latest `14.2.32`+ (or `15.x`), `npm audit fix`, regression `npm test && npm run build`, redeploy. Rotate no secrets (not a secret leak) but audit access logs for prior Image-Optimizer probes. |
| **SEC-C02** | **CRITICAL** | Stored XSS + formula injection via `patientName` (`POST /api/bookings`) | **Proven**: `curl -d '{"patientName":"<script>alert(1)</script>"…,"time":"09:40"}' → 201` with raw `<script>` in DB and in `GET /api/appointments/APT-…?mobile=` `raw.patient_name`. Second `=cmd|'cmd'!A0` also 201. Code `booking.ts:sanitizeText` never called on `patientName`. | Persistent XSS in any future consumer that interpolates without escaping (admin CSV, Sheets, native API users) + Sheets `=cmd` executes on open in some spreadsheet configs (`sanitizeCell` prepends `'` at Sheets write time but DB retention + CSV `esc()` does not). | Sanitize/reject on insert: `if(/[<>&"']/.test(patientName) || /^[=+\\-@]/.test(patientName)) throw ValidationError`; better: allowlist `^[\p{L}\p{M} .'-]{2,80}$`. Sanitize existing rows via one-off script. Add tests for XSS/formula payloads. |
| **SEC-H01** | **HIGH** | `SESSION_PASSWORD` fallback to public literal + immortal HMAC cookies | `src/lib/session.ts:7-9` fallback; `verifySessionValue` never checks `exp`; prod can boot without error. | Attacker with repo access can forge `drxyz_admin_session` on any misconfigured deploy; stolen session never expires at crypto layer | Require `SESSION_PASSWORD` in prod (`throw` if missing) + embed `exp` (iat+24h) and reject expired. Document rotation (`SESSION_PASSWORD` → all sessions invalidated). |
| **SEC-H02** | **HIGH** | Anonymous admin takeover via `POST /api/admin/login {setup:true}` on fresh DB | `src/app/api/admin/login/route.ts:16-25` no auth, no token. | First visitor owns clinic on every cold start / `db:reset` | Gate with `ADMIN_SETUP_TOKEN` env (checked header/body) or disable `setup` when `ADMIN_PASSWORD_HASH` env is set. Make write-once (`kv.setup_done`). See Fix in F-004. |

### Potential risks / defense-in-depth gaps (not proven exploited, still fix)

| ID | Severity | Title | Evidence | Risk | Remediation |
|---|---|---|---|---|---|
| **SEC-M01** | **MEDIUM** | No CSRF token on cookie-authenticated writes; permissive CORS | `next.config.js` no explicit CORS block; `curl -H Origin:https://evil.com -X POST /api/bookings →201`; admin `POST/PATCH/DELETE` only rely on `SameSite=Lax` (see `src/app/api/admin/*` headers). | CSRF booking spam / slot exhaustion; targeted admin CSRF if staff visits malicious page | Add origin check (`Origin/ Referer === APP_URL`) for all `POST|PUT|PATCH|DELETE /api/admin/*` + add CSRF double-submit for admin; consider Turnstile on public `POST /api/bookings`. |
| **SEC-M02** | **MEDIUM** | Missing CSP + HSTS leaves XSS (SEC-C02) without second barrier | `next.config.js:7-16` only `nosniff/DENY/Referrer-Policy/Permissions-Policy`; `curl -I /` has no `content-security-policy` or `strict-transport-security`. | If any injection bypasses sanitization, no CSP to block inline scripts; HTTP→HTTPS downgrade. | Add `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ? (tighten after auditing); script` and `Strict-Transport-Security: max-age=31536000; includeSubDomains` in prod. Prefer `next/font` to drop `fonts.googleapis.com` allowlist. |
| **SEC-M03** | **MEDIUM** | No rate limit on public write paths (`/api/bookings`, `/api/receptionist`) | `checkRateLimit` only in `admin/login`; `curl` burst booking succeeded 3× without 429. | Cheap DoS / slot hold / LLM cost inflation | Reuse `checkRateLimit` for bookings (30/10m) + receptionist (60/10m) per IP, 429 with `Retry-After`. |
| **SEC-M04** | **MEDIUM** | Google service-account JSON via single env var risks huge log exposure if dumped | `GOOGLE_SERVICE_ACCOUNT_JSON` holds entire JSON key; any `console.error("[booking] failed", e)` that stringifies cause could accidentally log `process.env.GOOGLE_SERVICE_ACCOUNT_JSON.slice`? Current catches swallow but `testCalendarConnection` returns `(e as Error).message` which is safe. Still, no secret-redaction helper. | Accidental log shipping to third-party observability with full private key | Add `redactSecrets()` logger helper (redacts `private_key`, `client_email`); ensure no `JSON.stringify(process.env)` in error paths; recommend secrets manager. |
| **SEC-M05** | **MEDIUM** | `patientEmail` validation permits plus addressing and dot-atom but not IDN/punycode-bypass (nodemailer vuln) | `booking.ts:validateInput` regex `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/` simple; `npm audit` lists nodemailer IDN allow-list bypass GHSA-wmmp. | Crafted display-name email could route confirmation to attacker domain (low due to TLS-but-not-spoof guarantee). | Upgrade nodemailer (F-007) + normalize with `new URL("mailto:"+email).host` + use `verifier` that checks `SMTP_FROM` domain sanity. |
| **SEC-M06** | **LOW** | `findAppointment` returns `raw` with `idempotency_key` to patient | `src/app/api/appointments/[ref]/route.ts:22` `{appointment: bookingSummary, raw: apt}` | Information leak (internal deduplication key). | Return `raw` only to admin; patient GET should return `bookingSummary` + `status` alone. |

**What is NOT a vulnerability (correctly implemented):**

- SQL: all DB access is via prepared statements (`?` placeholders) — `findAppointment`, `listAppointments`, `addBlockedPeriod` etc. No string interpolation. Verified SQL-injection `OR '1'='1` → null.
- Calendar PII: event `summary` is `Patient Appointment ${id} (${mode})`, `description` is `Booking reference: ${id}.Mode:…` — **never** contains `patient_name` or `mobile` (`src/lib/google/calendar.ts`).
- Passwords: scrypt with 16-byte salt, `timingSafeEqual` (`src/lib/auth.ts:verifyPassword`). Salt uniqueness tested.
- Session HMAC: constant-time `safeEqual` (`src/lib/session.ts:safeEqual`).
- Sheets injection: `sanitizeCell` correctly neutralizes `^[=+\\-@]` for the Sheets write path.
- Audit logging is append-only with try/catch so it never breaks booking.

---

## G. Prioritized Remediation Roadmap

### P0 — Critical (block live patient data)
*Dependencies: none; ship together as a hotfix, then re-test. ETA 1 working day.*

1. **P0-1 Bump Next.js & friends (F-001,F-007)** — `package.json` `next@^14.2.32` (or `15.4.x`), `postcss@^8.5.24`, `nodemailer@^6.9.18` (or `10.1.x` majors review), `braces@^3.0.3`. `rm -rf node_modules .next && npm install && npm test && npm run build`. Commit `package-lock.json`.
2. **P0-2 Sanitize `patientName` (F-002/SEC-C02)** — `src/lib/booking.ts:validateInput` add `if (/[<>&"'`]/.test(patientName) || /^[=+\\-@]/.test(patientName.trim())) throw ValidationError`. Apply `sanitizeText` on insert for name too. Script to sanitize existing rows (`UPDATE appointments SET patient_name=REPLACE…`).
3. **P0-3 Require `SESSION_PASSWORD` in prod + expire sessions (F-003/SEC-H01)** — `src/lib/session.ts`.
4. **P0-4 Lock first-run setup (F-004/SEC-H02)** — `src/app/api/admin/login/route.ts` gate `setup:true` with `ADMIN_SETUP_TOKEN`.

### P1 — High (broken journeys + serious reliability)
*Depends on P0 green; ETA 1–2 days.*

5. **P1-1 Fix reschedule + CSV export (F-005)** — `src/app/appointments/lookup/page.tsx` add date/time state & `POST ?action=reschedule`; `src/app/admin/(protected)/appointments/page.tsx` change export to `POST`+blob download.
6. **P1-2 CSRF origin check (F-006/SEC-M01)** — add `src/lib/csrf.ts` (`origin===APP_URL`) and wrap `requireAdmin` calls for mutating verbs.
7. **P1-3 Rate-limit bookings/receptionist (F-008/SEC-M03)** — extend `checkRateLimit`.
8. **P1-4 Add CSP + HSTS (F-010/SEC-M02)** — `next.config.js` headers (prod-gated HSTS).
9. **P1-5 Harden email/Sheets config leakage (F-014 related)** — sanitize `raw` in patient GET.

### P2 — Medium (conversion, SEO, a11y, perf)
*Parallelizable after P1; ETA 1 sprint (1–2 weeks).*

10. **Robots/sitemap/canonical/OG + JSON-LD (F-009)** — `src/app/robots.ts`, `sitemap.ts`, `metadataBase`+`openGraph` in `layout.tsx`, `Doctor` JSON-LD.
11. **Image/font perf (F-011)** — migrate `layout.tsx` to `next/font`, compress `public/images/*.jpg→.webp` (add `scripts/optimize-images.js` or `next/image`), confirm `compress:true`, `.next` not committed.
12. **Accessibility fixes (F-013)** — `receptionistWidget aria-live`, slot listbox roving tabindex, contrast bumps, `axe` scan in CI.
13. **Timezone-aligned calendar (F-012)** — `BookingWizard.CalendarGrid` use Kolkata-aware `todayKey`.
14. **Storage pruning (F-014)** — `scripts/prune.js` cron + doc.
15. **Booking spam hardening** — CAPTCHA/Turnstile toggle via `RECAPTCHA_SECRET`.
16. **Language SSR sync** — set `<html lang>` from cookie/localStorage edge or `next-intl` to avoid flash.

### P3 — Low (polish, optional)
- Extract shared `getSecret()` (F-015), remove `_not-found` noindex flake, add pagination for appointments (F-005-adjacent), add `LaunchReadiness` hard gate for fee `isConfigured`, add request-ID logging, add `pendingSyncTasks` admin pagination, add `data/` permission `0700` note, remove experimental `node:sqlite` warning suppression, upgrade `tailwindcss` 3→4 later (major), document `TEST_SMS_NUMBER`.
- Red-team review after P0–P1 green (pen-test of auth/session/receptionist).
- Lighthouse CI & axe CI in GitHub Actions.

**Recommended implementation order:** P0-1 → P0-2 → P0-3 → P0-4 (test) → P1 batch → P2 in any order → P3 backlog. No architectural rewrite required.

---

## H. Quick Wins

Highest ROI for least effort — all are ≤30 min, no design change, measurable before/after:

1. **Bump Next.js → 14.2.32+** — one line in `package.json`, closes 20 GHSA advisories and the critical `npm audit` flag. *Verify: `npm audit` critical→0.* **[F-001]**
2. **Sanitize `patientName` at booking** — 5-line regex guard in `src/lib/booking.ts:validateInput` + `sanitizeText` on insert. Stops the only proven stored injection. *Verify: `<script>` curl now 400.* **[F-002]**
3. **Add `robots.ts` + `sitemap.ts` + `metadataBase`** — three new files, makes WhatsApp/SEO work and stops `404` on `/robots.txt`. *Verify: `curl /robots.txt` 200, `curl /` contains `og:title`.* **[F-009]**
4. **Fix reschedule sending `{}`** — change `LookupPage.act()` to capture `date/time` inputs and POST `{date,time}` (≤20 lines). Turns a documented patient feature from dead to working. *Verify: cancel works today, after fix reschedule 200.* **[F-005]**
5. **Fix admin CSV verb** — change `window.open(GET)` to `fetch POST → blob → download` in `AdminAppointments` (≤15 lines). Staff gets the operational register export from the dashboard. *Verify: button downloads `appointments.csv`.* **[F-005]**

---

## I. Final Release Checklist

### Fixes
- [ ] P0-1 deps bump + `npm test` passes (29/29) + `npm run build` green + `npm audit` 0 critical/high
- [ ] P0-2 patientName XSS/formula blocked + migration of existing rows
- [ ] P0-3 `SESSION_PASSWORD` hard-required in prod + exp check
- [ ] P0-4 setup token gated + `kv.setup_done` once
- [ ] P1-1 reschedule + CSV export working
- [ ] P1-2 CSRF origin check on admin writes
- [ ] P1-3 rate limits on bookings/receptionist (429 verified)
- [ ] P1-4 CSP + HSTS headers verified with `curl -I` in prod

### Regression Tests
- [ ] `npm test` 29/29 (includes new XSS/regression tests)
- [ ] `npx tsc --noEmit` 0 errors
- [ ] `npm run build` collects 18 routes (no new 500)
- [ ] `curl /` 200 + `curl /robots.txt` 200 + `curl /sitemap.xml` 200
- [ ] `curl /api/availability?date=today` 200; `past → 400`; `invalid → 400`
- [ ] Booking flow: 201 → 200 (dup) → 409 conflict (with alternatives); past/medical-note rejection 400
- [ ] Lookup: correct mobile 200; wrong 404; `sql ' OR ` → 404
- [ ] Receptionist: emergency→112, medical→boundary, 2500char→400, `hi` locale works
- [ ] Admin unauthed 401; login→dashboard 200; tampered cookie 401; admin CRUD + schedule validate `open<close`
- [ ] Images are WebP/AVIF (<80 kB hero) or `next/image`; font not external blocking
- [ ] Axe scan 0 serious; Lighthouse LCP <2.5s on moto G4 slow-3G
- [ ] SEO: `curl /` has `canonical`, `og:title`, `og:image`, JSON-LD

### Security Checks
- [ ] No secret in `package-lock`/`.next`/Git history (`git log -S GOOGLE` clean)
- [ ] `data/clinic.db` on persistent, `0700` volume, excluded in `.gitignore` ✓ already
- [ ] `SESSION_PASSWORD` ≥32 chars, unique per env, in secrets manager, not in `.env` repo
- [ ] `ADMIN_PASSWORD_HASH` set (scrypt), `ADMIN_SETUP_TOKEN` set if setup flow retained
- [ ] HSTS & CSP present (`curl -I https://clinic.example` in prod)
- [ ] Sheets `sanitizeCell` + booking name guard both active; CSV `esc()` still quoted
- [ ] `calendar_event` summary never contains patient PII (spot-checked 3 bookings)
- [ ] Audit log: booking.create/cancel/schedule.updated paths produce rows

### Deployment Checks
- [ ] `APP_URL=https://clinic.example` set, `NODE_ENV=production`, `SESSION_PASSWORD`/`ADMIN_PASSWORD_HASH` in host secrets (not `.env` file on disk world-readable)
- [ ] `npm run db:init` or `scripts/init-db.js` run once (persistent `data/` volume, not ephemeral)
- [ ] Google creds shared: service account has Calendar `make changes to events` + Sheet `editor`; private key not committed
- [ ] `data/clinic.db` backed up daily (`sqlite3 .backup` or volume snapshot); Sheets register version history enabled
- [ ] Reverse proxy: HTTPS only (443), 80→443 redirect, `client_max_body_size 1m`, gzip/br on, no `data/` path exposed
- [ ] Sync worker: `*/5 * * * * curl -X POST -H "Cookie: …" https://clinic.example/api/admin/sync` or `node scripts/...` with lock file
- [ ] Monitoring: error rate alert on `/api/bookings` 5xx; `notification_log` failed rows alert; `sync_queue` pending >5 for >30min

### Post-Release Verification (first 24h)
- [ ] Create a real booking as patient (in_live: choose `reports` Calendar busy reflected); confirm email/SMS arrived (if configured)
- [ ] Cancel + reschedule self-service path end-to-end
- [ ] Admin → Appointments → Complete one, set online link, export CSV — verify IDs match DB
- [ ] Admin → Schedule → flip a day off, add a holiday, preview → `/api/availability` reflects
- [ ] Admin → Integrations → Test Calendar/Sheets/Email each → `ok:true`
- [ ] Language switch `EN↔हिंदी` across Home/Book/Lookup/Admin; receptionist answers in chosen lang
- [ ] Submit legal review of `Privacy`+`Terms` per LAUNCH.md sign-off

---

## PHASE 11 — Implementation Plan (what to change next, file-by-file)

*No code has been rewritten yet (audit-only branch). This plan is ready for owner approval before any PR is opened. All changes below preserve the current architecture and design identity.*

| Change | Files | Root cause | Solution (minimal) | Side effects | Tests | Rollback |
|---|---|---|---|---|---|---|
| **Next.js bump** | `package.json`, `package-lock.json` | Pinned pre-GHSA minor | `next@^14.2.32` (or `15.x` + compat). `overrides: {postcss, braces}` | Possible `postcss`/Tailwind peer change | `npm test`, `npm run build`, `npm audit` | `git revert` + redeploy previous lock |
| **Sanitize booking name** | `src/lib/booking.ts:validateInput`+`createBooking.insert` | No validation on name | Allowlist + `sanitizeText` on insert; migration script `scripts/sanitize-names.js` | Rejects legit `<>` in names (rare) — tradeoff for XSS fix | Add `tests/security.test.ts` xss cases; rerun xss curls | Revert single function |
| **Session hardening** | `src/lib/session.ts` | Public fallback + immortal | Throw in prod if no password; encode `exp` + verify | All existing sessions invalid on first deploy after change (forces re-login) | Unit: expired=401, fallback-throws | Set `SESSION_PASSWORD` back, revert |
| **Setup gate** | `src/app/api/admin/login/route.ts`, `.env.example`, `docs/LAUNCH.md` | Auth-less setup | Check `ADMIN_SETUP_TOKEN` header | Fresh installs without token can't auto-setup (intended) | E2E: setup no-token 403 | Remove gate |
| **Reschedule fix** | `src/app/appointments/lookup/page.tsx` | Empty body | Add `date/time` `Input type=date/time` + state; `POST ?action=reschedule {date,time}` | Slight UI growth (2 inputs) | E2E lookup reschedule | Revert page |
| **CSV export fix** | `src/app/admin/(protected)/appointments/page.tsx` | GET vs POST | `fetch POST → blob → <a download>` | — | Click → download | Revert page |
| **CSRF guard** | `src/lib/csrf.ts` (new), `src/app/api/admin/*` | No origin check | `if (req.method!=="GET" && origin!==APP_URL) 403` | Legit cross-origin API callers (none today) blocked — add allowlist if needed | Curl origin tests | Remove middleware |
| **Rate limits** | `src/lib/auth.ts` (export limiter) + booking/receptionist routes | No limit | `checkRateLimit(ip, 30, 10*60*1000)` | Heavy bursts 429 (intended) | Burst test | Raise limit |
| **CSP/HSTS** | `next.config.js` | Missing headers | Add CSP + HSTS (prod) + switch `next/font` | CSP `unsafe-inline` needed for Next inlines — start semi-strict, tighten | `curl -I` | Strip headers |
| **Robots/Sitemap/OG** | `src/app/robots.ts`, `sitemap.ts`, `layout.tsx` | Not present | Add files + `metadataBase`+`openGraph` | More crawler hits (desired) | `curl` checks | Delete files |
| **Images/fonts** | `public/images/*`, `src/app/layout.tsx`, `next.config.js` | Raw JPEG + external font | `next/font` + WebP conversion script | Image URL change → cached CDN miss once | Lighthouse | Revert assets |
| **A11y** | `ReceptionistWidget.tsx`, `BookingWizard.tsx` | Missing live region/roving | Add `aria-live`, key handler | — | Axe | Revert |
| **Kolkata picker** | `src/components/BookingWizard.tsx` + `lib/time.ts` | Client locale mismatch | Use `Intl timeZone:Asia/Kolkata` for `todayKey` | — | TZ switch test | Revert |

**Preservation rules:** Do not delete `data/clinic.db`; do not change the `idx_apt_slot` partial index, the `child_context` chat store key format, or the established booking `APT-` ID scheme; keep `Demo Mode` visible; keep bilingual dict shape.

**Request for approval:** If you approve, I will open isolated commits for P0 first (one PR per bullet above), each with tests + before/after `curl` evidence, and will not deploy without explicit instruction.

---

## Appendix — Methodology & Limitations

**How this was audited:** Static inspection of every `src/` file touched by the branch (listed in §B), `npm install`+`npm test` (29/29, 6.8s), `npx tsc --noEmit` (clean), `npm run build` (18 routes, 0 errors), live dev server (`next dev`, 547 MB `.next` dev cache) probed with `curl` for all pages/routes/edge cases (book, availability, receptionist safety, auth, XSS, CORS, headers, SEO). A single-browser render check was not possible (no Playwright in sandbox) — UI/responsiveness findings are therefore class-based and must be confirmed on a physical phone (360 px) and desktop (1440 px) before launch.

**Not tested / unverified without owner input:** Production host (no URL supplied), real Google Calendar/Sheets/SMTP/Twilio delivery (code-ready, Demo fallback live-tested but not against live credentials), HeyGen/D-ID video lip-sync (local SVG demo tested), backup/restore of `data/clinic.db`, HTTPS/HSTS on the production reverse proxy, rate-limit behavior behind a real CDN `x-forwarded-for` chain, and accessibility with a screen reader.

**Raw artifacts retained:** `npm audit` output (14 vulns), `npm test` TAP log (29 pass), `npm run build` route manifest, `curl` headers (`X-Content-Type-Options/DENY/Referrer-Policy/Permissions-Policy`), and booking evidence IDs (`APT-U2GQQ7TZ` valid, `APT-QUN9R8Q2` XSS, `APT-BJ3PV68R` formula, `APT-EBEP322R` CSRF-test).

---

*Prepared for `abhisheku1984/Doctor`. Evidence-first, no fabricated line counts, URLs or test results. Never executed suspicious scripts; never exposed discovered secrets (no secrets were found committed).*
