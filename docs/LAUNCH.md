# Pre-Launch Checklist for the Clinic

The site is fully functional in Demo Mode. Complete these items before going live.

## 1. Clinic configuration (`config/clinic.json`)

- [ ] Doctor speciality
- [ ] Qualifications (**verified** — never publish unverified credentials)
- [ ] Professional registration (council + number, verified against the state medical council register)
- [ ] Years of experience
- [ ] Clinic name, address, city, state, PIN
- [ ] Clinic phone + email
- [ ] Consultation fee (in-person and online)
- [ ] Working days & hours (or confirm in Admin → Schedule)
- [ ] Services list with accurate descriptions
- [ ] FAQs
- [ ] Doctor's real portrait photo (replace `public/images/doctor-portrait.jpg`)
- [ ] Clinic address + Google Maps link (Contact page)

**Do not** publish placeholder qualifications as real credentials. Everything marked
"[TO BE CONFIGURED]" is visibly flagged until completed.

## 2. Integrations

- [ ] Google service account + Calendar share (see GOOGLE_SETUP.md)
- [ ] Google Sheets register created + shared
- [ ] SMTP credentials (confirmations/reminders)
- [ ] Twilio (optional SMS)
- [ ] Teleconsultation platform (Google Meet / Jitsi / Zoom) for online consults
- [ ] Avatar provider (optional — local demo avatar works meanwhile)

## 3. Security & legal

- [ ] Set `SESSION_PASSWORD` and `ADMIN_PASSWORD_HASH` (never plaintext)
- [ ] HTTPS enforced in production
- [ ] Privacy Policy, Terms, and Cancellation Policy reviewed by the clinic's counsel
- [ ] Data retention/deletion procedure confirmed (Privacy Policy)
- [ ] Emergency notice (112) present on every page footer ✓ (built-in)
- [ ] Avatar provider privacy review completed (see AVATAR_SETUP.md checklist)

## 4. Operational

- [ ] Verify a real end-to-end booking in Live Mode
- [ ] Verify calendar event creation + Sheets row
- [ ] Verify confirmation email/SMS delivery
- [ ] Confirm backup plan for `data/clinic.db`
- [ ] Staff trained on Admin → Appointments / Schedule / Integrations

The admin dashboard shows a live **Launch readiness** panel tracking items 1–2.
