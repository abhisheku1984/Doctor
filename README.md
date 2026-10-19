# Dr. XYZ — Premium AI-Enabled Clinic Website

A production-ready healthcare web application: premium clinic website, guided appointment booking with live availability, a talking AI receptionist, Google Calendar + Google Sheets integration, automated notifications, and a secure admin portal.

## Quick start

```bash
npm install
npm run db:init          # creates data/clinic.db with the demo schedule
cp .env.example .env     # then edit (SESSION_PASSWORD at minimum)
npm run dev              # http://localhost:3000
```

The app runs fully in **Demo Mode** with zero external credentials — booking, availability, the AI receptionist (text + browser voice), and the admin dashboard all work immediately. Demo Mode is always visibly banner-labeled, and simulated availability is never presented as live.

## First admin login

1. Open `/admin/login` → **First time? Set up an admin password**, or:
   ```bash
   node scripts/hash-password.js 'your-strong-password'
   # paste the output into .env as ADMIN_PASSWORD_HASH
   ```
2. Sign in with `ADMIN_USERNAME` (default `clinicadmin`).

## What's implemented

| Area | Status |
|---|---|
| Premium responsive website (17 routes) | ✅ |
| Guided booking (mode → details → slot → review → confirm) | ✅ |
| Concurrency-safe reservations (SQLite `BEGIN IMMEDIATE` + unique slot index) | ✅ |
| Idempotent booking (retry-safe, unique booking IDs) | ✅ |
| Schedule / breaks / holidays / blocked-slot management | ✅ |
| AI receptionist (text chat, booking flow, browser voice, captions, states) | ✅ local demo provider |
| Avatar integration layer (HeyGen / D-ID adapters) | 🔌 documented integration point |
| Google Calendar (live availability, event create/update/cancel) | ✅ code-ready, needs credentials |
| Google Sheets register (4 worksheets, retry queue, reconciliation) | ✅ code-ready, needs credentials |
| Email (SMTP) & SMS (Twilio) notifications | ✅ code-ready, needs credentials |
| Online consultation links (Google Meet / Jitsi / custom) | ✅ configurable |
| Secure admin dashboard (auth, RBAC gate, audit log, rate limits) | ✅ |
| Patient self-service lookup / cancel / reschedule | ✅ |
| Automated tests (29) | ✅ `npm test` |

## Project structure

```
src/
  app/                  # Next.js App Router pages + API routes
    api/bookings        # POST /api/bookings (create, idempotent)
    api/availability    # GET  live slot availability
    api/appointments/[ref]  # patient lookup / cancel / reschedule
    api/receptionist    # AI receptionist chat endpoint
    api/admin/*         # protected admin operations
    admin/              # dashboard, appointments, schedule, integrations
  components/           # UI kit, booking wizard, receptionist widget
  lib/
    booking.ts          # availability + concurrency-safe reservation engine
    db.ts               # SQLite schema (node:sqlite, zero native deps)
    google/calendar.ts  # Calendar provider (null → Demo Mode)
    google/sheets.ts    # Sheets register + sync helpers
    receptionist.ts     # config-grounded conversation engine
    avatar.ts           # avatar provider abstraction
    notifications.ts    # pluggable email/SMS providers
    auth.ts / session.ts# admin auth (scrypt + signed cookies)
config/clinic.json      # ← clinic-editable configuration (no code changes)
tests/                  # node:test suite
docs/                   # setup & deployment guides
```

## Documentation

- **[docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)** — Calendar + Sheets credentials
- **[docs/AVATAR_SETUP.md](docs/AVATAR_SETUP.md)** — realistic talking-avatar providers
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — production deployment
- **[docs/LAUNCH.md](docs/LAUNCH.md)** — pre-launch checklist for the clinic
- **[docs/EXTERNAL_CREDENTIALS.md](docs/EXTERNAL_CREDENTIALS.md)** — every feature needing credentials
- **[docs/TEST_RESULTS.md](docs/TEST_RESULTS.md)** — acceptance test results

## Safety & privacy

The AI receptionist is an administrative assistant only — it never diagnoses, prescribes, or presents itself as Dr. XYZ, and routes emergencies to **112** (India). Only the minimum necessary patient data is collected; no diagnoses or clinical histories are stored; calendar events contain booking references, not patient names.
