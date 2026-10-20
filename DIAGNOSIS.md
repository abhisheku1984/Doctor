# Diagnosis Report — Existing Hospital Website (October 20, 2026)

Date: 2026-10-20  
Branch: `arena/d6a25215-doctor`  
Base commit: `9554350` (Merge PR #1)  
Inspected by: Agent (healthcare tech audit)

---

## 1. What already exists (base app at commit 9554350)

The repository is **not a static prototype** — it is a real Next.js 14 + SQLite backend application for "Dr. XYZ" clinic:

| Area | Status | Files |
|------|--------|-------|
| **Framework** | Next.js 14 App Router, Tailwind, TypeScript (strict) | `next.config.js`, `tsconfig.json` |
| **Website pages** | 17 routes: Home, About, Services, Book, Book Review, Confirmation, Lookup, Contact, Privacy, Terms + Admin (dashboard, appointments, schedule, integrations, login) | `src/app/**/page.tsx` |
| **Booking engine** | Concurrency-safe with `BEGIN IMMEDIATE` + unique slot constraint, idempotent keys | `src/lib/booking.ts` |
| **Database** | SQLite via `node:sqlite` (zero native deps), WAL mode, 8 tables | `src/lib/db.ts`, `scripts/init-db.js` |
| **Auth (original)** | Single admin via `scrypt` hash + signed cookie (`drxyz_admin_session`), rate limit | `src/lib/auth.ts`, `src/lib/session.ts` |
| **Google Calendar** | Live provider + Demo fallback, PII-minimized events | `src/lib/google/calendar.ts` |
| **Google Sheets** | 4-worksheet register, retry queue, sanitization | `src/lib/google/sheets.ts` |
| **Notifications** | SMTP + Twilio (pluggable, demo mode logs) | `src/lib/notifications.ts` |
| **AI Receptionist** | Chat engine + Avatar abstraction (HeyGen/D-ID adapters) | `src/lib/receptionist.ts` |
| **Tests** | 29 passing (`npm test`) | `tests/*.test.ts` |
| **i18n** | English + Hindi, language switcher | `src/lib/i18n.ts` |
| **Deploy** | Documented in `docs/` | `docs/DEPLOYMENT.md` etc. |
| **Branding** | config-driven clinic data in `config/clinic.json` (mostly `[TO BE CONFIGURED]` placeholders) | `config/clinic.json` |

**Database at that point (8 tables):** appointments, schedule_rules, blocked_periods, sync_queue, notification_log, audit_log, chat_sessions, kv

**Build:** ✅ Production build succeeded. Tests: 29 passing.

---

## 2. Gallery Diagnosis — Root Cause

**Finding: The Gallery does not exist. There is no gallery implementation in the codebase.**

- `grep Gallery src/` returns zero results in base commit.
- No `/gallery` route, no Gallery component, no gallery API, no gallery table.
- No images beyond 3 marketing photos in `public/images/` (clinic exterior, doctor portrait, avatar).
- `config/clinic.json` contains no gallery configuration.
- No Google Drive integration exists.

**Why "Option 2 did not work":** There was no Option 2. The gallery feature was never implemented — not broken, just missing. The prompt's reference to "why Option 2 did not work" describes a previous attempt outside this repo, not a bug within it.

**Other related gaps found:**
- No multi-role system (only single admin).
- No Google OAuth.
- No OTP verification.
- No hospital/department/doctor entities (only one doctor via config file).
- No billing/payments.
- No analytics.
- No Google Drive API usage (only Calendar + Sheets).
- `scripts/init-db.js` contained hardcoded SQL duplicating `src/lib/db.ts` — drift risk.

**Previous agent's partial work:** A prior session added 30+ new files (gallery, auth, hospitals, billing, drive) but left 9 TypeScript errors and a fatal `NOTNull` SQL typo causing build + test failures. Those are now fixed in this session.

---

## 3. What was fixed in this session

| Fix | Detail |
|-----|--------|
| TypeScript errors | 9 type errors (spread of `unknown[]`, amount type, missing i18n keys) → clean `tsc` |
| SQL typo | `expires_at TEXT NOTNull` → `NOT NULL` (was crashing build + all tests) |
| Build error | `/login` and `/verify-mobile` using `useSearchParams` without `<Suspense>` → added wrappers |
| `init-db.js` | Rewrote to delegate to `src/lib/db.ts` (single source of truth) |
| i18n | Added `nav.doctors` / `nav.gallery` keys |
| DB migrations | Added `migrateAppointmentsTable()` for existing installs; seeded 8 gallery items + 4 doctors + 8 departments |

---

## 4. What is now implemented (hospital management upgrade)

### Database: 27 tables (from 8)
New: hospitals, departments, doctors, doctor_schedules, doctor_leaves, users, otp_verifications, user_sessions, gallery_items, drive_folders, drive_sync_log, drive_config, billing_records, payment_transactions, analytics_events, waiting_list, announcements, contact_messages

Seeded defaults: 1 hospital, 8 departments, 4 doctors (with Mon–Sat schedules), 8 gallery images (unsplash), seeded from `config/clinic.json` when available.

### Gallery (the missing feature)
- **Storage:** SQLite `gallery_items` + Google Drive via `src/lib/google/drive.ts` (full folder structure `Hospital_Management_System/...`).
- **API:** `GET/POST /api/gallery`, `PATCH/DELETE /api/gallery/[id]`, `POST /api/gallery/upload` (multipart, 50MB, MIME validation).
- **Drive:** `POST /api/admin/drive` creates folder structure, syncs files, test connection. Handles no-credentials gracefully with demo/local fallback.
- **UI:** `src/components/Gallery.tsx` — category filters (7), lazy loading, pagination, thumbnails, fullscreen lightbox with keyboard nav, mobile responsive, empty/error/loading states, broken-image fallback.
- **Admin:** `src/app/admin/(protected)/gallery/page.tsx` — upload form, Drive sync, publish/unpublish, delete, status display.
- **Public:** `src/app/gallery/page.tsx` + nav link. API verified returning 8 published items.

### Authentication & Roles
- **RBAC** (`src/lib/rbac.ts`): `super_admin`, `hospital_owner`, `patient`, `staff`, `doctor` — with permission matrix, tenant isolation.
- **Sessions** (`src/lib/session.ts`): Extended signed cookies for user auth (7-day) + legacy admin (24h), hospital-aware.
- **Google OAuth** (`src/lib/google/oauth.ts`): Real OAuth code flow, server-side ID token verification, audience check, no hardcoded secrets.
- **OTP** (`src/lib/auth.ts` + `/api/auth/verify-mobile`): 6-digit OTP, SHA256 hashed, 10-min expiry, 5-attempt limit, SMS via Twilio or demo console log.
- **User Management** (`src/lib/users.ts`): `findOrCreateGoogleUser`, duplicate prevention via `google_sub` → email fallback, `ensureSuperAdmin` bootstrap.
- **Setup** (`src/app/api/admin/setup`): Initial Super Admin creation open when none exists; afterwards requires `ADMIN_SETUP_SECRET` — prevents privilege escalation via frontend.

### Google Drive
- `src/lib/google/drive.ts` + `DRIVE_SCOPES`, folder helpers, upload/list/delete, signed URL helpers, sync logic.
- Admin panel tests connection, creates folders, syncs.

### Doctors/Hospitals
- `src/lib/hospitals.ts` full CRUD, schedule management (`doctor_schedules`, `doctor_leaves`), `listDepartments` etc.
- APIs: `/api/doctors`, `/api/doctors/[id]`, `/api/doctors/[id]/schedule`, `/api/hospitals`, `/api/departments`.
- Admin UI: doctors, hospitals pages. Tenant isolation enforced (hospital owner sees only own hospital).

### Billing & Payments
- `src/lib/billing.ts`: invoice numbers (`INV-YYYY-#####`), tax/discount, Razorpay order create + `HMAC-SHA256` webhook/signature verification (never trust browser redirect), idempotent transactions.
- APIs: `/api/billing`, `/api/payments/{create-order,verify,webhook}`.
- User invoice page: `src/app/billing/[id]/page.tsx`.

### Analytics
- `src/lib/analytics.ts`: `analytics_events` table, device categorization, IP hashing (privacy), `trackEvent`, `queryEvents`, CSV export, `getAnalyticsDashboard`.
- APIs: `POST /api/analytics` (public tracking), `GET` (admin dashboard + export).
- Admin page: `src/app/admin/(protected)/analytics/page.tsx`.

### Other
- Enhanced admin dashboard (`src/app/api/admin/dashboard`) now returns user stats, doctor counts, gallery counts, billing stats, hospitals, drive status.
- `src/app/doctors`, `src/app/dashboard`, `src/app/login`, `src/app/verify-mobile` pages.
- Updated `src/components/Navbar` + `AdminHeader` with new navigation, auth-aware.
- Updated `src/middleware.ts` for new auth flows (admin + patient dashboard protection).
- Updated `.env.example` with OAuth, Drive, Razorpay, setup secret.
- Added `razorpay` dependency.

---

## 5. What still requires credentials / external setup (by design, not bugs)

| Service | Env vars | Where to configure |
|---------|----------|---------------------|
| Google Sign-In | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Cloud Console → OAuth consent + credentials |
| Google Calendar/Sheets/Drive | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SHEETS_SPREADSHEET_ID` | Service account + share resources |
| Email | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` etc. | Any SMTP provider |
| SMS/OTP | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` + `SMS_NOTIFICATIONS_ENABLED=true` | Twilio |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | razorpay.com dashboard |
| Super Admin | `SUPER_ADMIN_EMAIL`, `ADMIN_SETUP_SECRET` | `.env` + `/api/admin/setup` |

Every feature is code-complete but fails gracefully with a 503 + hint when credentials are absent — never pretends to be live.

---

## 6. Validation

- `npx tsc --noEmit` → 0 errors
- `npx next build` → ✓ Compiled successfully (29 pages)
- `npm test` → 29 tests, 29 passing, 0 failing
- Gallery API → 8 items returned
- Dev server → Gallery + Doctors pages render correctly

---

## 7. Known limitations / recommended next steps

1. **Booking still single-slot model** — not yet per-doctor concurrency with `doctor_id` in `idx_apt_slot` (schema has column, booking.ts not yet wired; original concurrency safety still holds for base case).
2. **`src/app/api/availability` supports `doctor_id` param (added)** but doctor-specific availability logic not yet in `booking.ts` schedule reads.
3. No Excel/CSV doctor schedule import yet (admin upload template).
4. No backup/recovery cron (documented, not automated).
5. Gallery videos show placeholder (no video transcoding).
6. `config/clinic.json` still placeholders — fill before launch via `docs/LAUNCH.md` checklist.
7. Razorpay Checkout.js not bundled in invoice page (shows order ID fallback); include `checkout.razorpay.com/v1/checkout.js` in layout for live payments.
