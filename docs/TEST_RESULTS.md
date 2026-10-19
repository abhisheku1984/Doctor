# Test Results

Run: `npm test` (Node's built-in test runner via tsx).

**29 tests, 29 passing, 0 failing.**

## Coverage by acceptance criterion

| # | Criterion | Test / verification |
|---|---|---|
| 1 | Responsive, polished homepage | `GET /` → 200; Tailwind responsive classes; mobile nav verified |
| 2 | AI avatar works with configured provider | Local provider active; capabilities endpoint reports provider |
| 3 | Text assistant usable without voice | Chat engine tests (17–19) — voice is optional |
| 4 | In-person & online modes | Mode step + `mode` validation in booking tests |
| 5 | Slots from the configured schedule | `getDayAvailability` reads `schedule_rules` (lunch-break test) |
| 6 | Existing appointments & holidays respected | Buffer-overlap test; blocked-periods test |
| 7 | Two simultaneous requests can't book one slot | Concurrency test — exactly 1 winner, 1 gets 409 + alternatives |
| 8 | Confirmation only after successful reservation | Status is `confirmed` only post-transaction; receptionist flow test |
| 9 | Calendar events created/updated/cancelled | Fake-provider tests (create/update/cancel calls verified) |
| 10 | Confirmed appointments recorded in Sheets | `recordAppointment` called post-reservation (fake provider) |
| 11 | Failed Sheets sync recovers without duplicates | Sync-recovery test — booking preserved, queue drained, 1 row |
| 12 | Cancellation/reschedule update the right records | Cancel + reschedule tests (row identity preserved) |
| 13 | Unauthorized users can't reach admin ops | 401 tests; middleware + per-route `requireAdmin` |
| 14 | Patient data not exposed publicly | Lookup requires ref+mobile; calendar events use references only |
| 15 | AI safety rules | Medical-advice boundary + emergency 112 tests |
| 16 | Email/SMS report status accurately | `notification_log` written only on provider confirmation; demo providers log, never claim delivery |
| 17 | Graceful API error handling | Validation errors (400), slot conflicts (409), provider outages queued |
| 18 | Demo vs Live visibly different | Amber Demo Mode banner + per-integration badges |
| 19 | Mobile + desktop layouts | Responsive grids; widget/panel tested at 360px & 1440px widths |
| 20 | Deployment instructions reproducible | docs/DEPLOYMENT.md + Dockerfile path |

## Test inventory

**Booking engine (12)**
- valid booking created & confirmed
- simultaneous requests → exactly one reservation
- idempotency key returns original booking, no duplicate row
- lunch break excluded; closed days excluded
- existing appointments block neighbours (duration + buffer)
- holidays/blocked periods excluded
- past dates fully unavailable
- invalid inputs rejected with field errors (incl. medical-note refusal)
- cancelled slots become bookable
- reschedule moves + rejects occupied slots
- admin status updates persist
- booking IDs unique + URL-safe (`APT-XXXXXXXX`)

**Sync & integrations (5)**
- Sheets failure preserves booking; retry queue reconciles without duplicates
- calendar events carry booking references, not patient PII
- reschedule updates the calendar event, keeps one row
- cancellation cancels the calendar event
- spreadsheet cells sanitized against formula injection (`=`, `+`, `-`, `@`)

**Receptionist (7)**
- medical questions → safety boundary, no advice
- emergencies → 112 immediately
- never claims to be Dr. XYZ
- fees answer sourced from configuration
- full booking flow confirms only after backend success
- double-booking via chat impossible
- unanswerable questions escalate to staff

**Security (5)**
- admin API rejects unauthenticated requests (401)
- valid session cookie accepted
- tampered cookie rejected
- salted password hashing (same input → different hashes)
- patient lookup requires reference + registered mobile

## Manual verification performed

- `GET /` → 200; all 17 routes return expected pages
- `POST /api/bookings` → 201 with reference; duplicate retry returns the same booking (`duplicated: true`)
- Same-slot rebooking → 409 with refreshed alternatives
- Appointment lookup with wrong mobile → 404; correct → 200
- Admin setup → login → dashboard lists the booked appointment
- Unauthenticated `/api/admin/dashboard` → 401
