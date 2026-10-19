# Google Workspace Setup (Calendar + Sheets)

These steps move the site from **Demo Mode** to **Live Mode** for availability and the appointment register.

## 1. Create a dedicated clinic Google account

Use a dedicated Google account for the clinic (not a personal account), e.g. `frontdesk@yourclinic.in`.

## 2. Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com) → **Create Project** → name it "Dr. XYZ Clinic".
2. Enable the **Google Calendar API** and **Google Sheets API** (APIs & Services → Library).
3. Create a **service account** (APIs & Services → Credentials → Create Credentials → Service Account).
4. Grant it the roles *Calendar API Service Agent* (or just share resources with its email — see step 4).
5. Generate a **JSON key** and download it.

## 3. Create the calendar

In the clinic Google account's calendar UI, create a calendar named **"Dr. XYZ — Patient Appointments"** (or run `node scripts/setup-google.js`, which creates both the calendar and the spreadsheet).

**Share that calendar with the service account's email** (the `client_email` in the JSON key) with **Make changes to events** access.

## 4. Create the appointment register spreadsheet

Create a Google Sheets spreadsheet named **"Dr. XYZ — Clinic Appointment Register"** with four worksheets:

1. **Appointments** — columns: Appointment ID, Created At, Appointment Date, Appointment Time, Patient Name, Patient Mobile, Patient Email, Consultation Mode, Service, Appointment Duration, Appointment Status, Calendar Event ID, Notification Status, Last Updated
2. **Doctor Schedule** — Schedule ID, Day of Week, Opening Time, Closing Time, Break Start, Break End, Appointment Duration, Buffer Duration, Active Status
3. **Holidays and Blocked Slots** — Date, Start Time, End Time, Reason, Updated By, Last Updated
4. **Daily and Monthly Summary** — (written automatically by the sync worker)

**Share the spreadsheet with the service account email** with **Editor** access.

Alternatively, run `node scripts/setup-google.js` with `GOOGLE_SERVICE_ACCOUNT_JSON` set — it creates both resources and prints the IDs.

## 5. Configure environment variables

```bash
# The whole JSON key as a single line (or use a secrets manager)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
GOOGLE_CALENDAR_ID=primary          # or the calendar's ID
GOOGLE_SHEETS_SPREADSHEET_ID=       # from the spreadsheet URL
```

## 6. Verify

- Admin → **Integrations** → **Test connection** for both Calendar and Sheets.
- The Demo Mode banner disappears and availability cross-checks the real calendar.
- New bookings create calendar events (titled with the booking reference only) and append rows to the register.

## Behaviour notes

- Availability = clinic schedule − breaks − holidays/blocked slots − confirmed bookings − Google Calendar busy events.
- A calendar event is created **after** the DB reservation succeeds; if Google is down, the booking stays valid and the event is created by the retry worker (visible in Admin → Integrations until reconciled).
- The Sheets register is the operational record — it is **never** used to lock slots (the transactional database does that).
- If Calendar succeeds but Sheets fails, the booking stands; the Sheets write is retried without creating a duplicate appointment.
