#!/usr/bin/env node
/**
 * One-time Google setup helper.
 *
 * 1) Creates the "Dr. XYZ — Patient Appointments" calendar.
 * 2) Creates the "Dr. XYZ — Clinic Appointment Register" spreadsheet
 *    with all four worksheets and prints its ID.
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON in the environment.
 * The service account must be domain-wide delegated or the
 * calendar/spreadsheet must be shared with its email address.
 *
 * Usage:
 *   GOOGLE_SERVICE_ACCOUNT_JSON='{...}' node scripts/setup-google.js
 */

async function main() {
  const { google } = require("googleapis");
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error("Set GOOGLE_SERVICE_ACCOUNT_JSON first (a service-account JSON key).");
    process.exit(1);
  }
  const key = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  await auth.authorize();
  console.log(`Authenticated as ${key.client_email}`);

  const calendar = google.calendar({ version: "v3", auth });
  const cal = await calendar.calendarList.insert({
    requestBody: { summary: "Dr. XYZ — Patient Appointments" },
  });
  console.log(`Calendar created: ${cal.data.summary} (id: ${cal.data.id})`);
  console.log("→ Set GOOGLE_CALENDAR_ID to the id above.");

  const sheets = google.sheets({ version: "v4", auth });
  const sheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Dr. XYZ — Clinic Appointment Register" },
      sheets: [
        { properties: { title: "Appointments" } },
        { properties: { title: "Doctor Schedule" } },
        { properties: { title: "Holidays and Blocked Slots" } },
        { properties: { title: "Daily and Monthly Summary" } },
      ],
    },
  });
  const sid = sheet.data.spreadsheetId;
  const headers = {
    "Appointments!A1": [
      "Appointment ID", "Created At", "Appointment Date", "Appointment Time", "Patient Name",
      "Patient Mobile", "Patient Email", "Consultation Mode", "Service", "Appointment Duration",
      "Appointment Status", "Calendar Event ID", "Notification Status", "Last Updated",
    ],
    "Doctor Schedule!A1": [
      "Schedule ID", "Day of Week", "Opening Time", "Closing Time", "Break Start",
      "Break End", "Appointment Duration", "Buffer Duration", "Active Status",
    ],
    "Holidays and Blocked Slots!A1": ["Date", "Start Time", "End Time", "Reason", "Updated By", "Last Updated"],
    "Daily and Monthly Summary!A1": ["Report", "Value", "", "", ""],
  };
  for (const [range, values] of Object.entries(headers)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  }
  console.log(`Spreadsheet created: ${sheet.data.properties.title}`);
  console.log(`→ Set GOOGLE_SHEETS_SPREADSHEET_ID to: ${sid}`);
  console.log("\nFinally, share BOTH the calendar and the spreadsheet with the service");
  console.log(`account email: ${key.client_email}`);
}

main().catch((e) => {
  console.error("Setup failed:", e.message);
  process.exit(1);
});
