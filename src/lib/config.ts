/**
 * Centralized clinic configuration.
 *
 * The clinic edits `config/clinic.json` — no source-code changes required.
 * Sensitive values (API keys, calendar IDs) come from environment variables,
 * never from this public-facing config file.
 */
import fs from "fs";
import path from "path";
import { z } from "zod";

export { TIMEZONE } from "./config-shared";

const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationMinutes: z.number().int().positive(),
  description: z.string(),
  modes: z.array(z.enum(["in_person", "online"])).min(1),
});

const clinicConfigSchema = z.object({
  doctor: z.object({
    name: z.string().min(1),
    title: z.string(),
    speciality: z.string(),
    qualifications: z.array(z.string()),
    registration: z.object({
      council: z.string(),
      registrationNumber: z.string(),
      verificationUrl: z.string(),
    }),
    yearsOfExperience: z.union([z.string(), z.number()]),
    about: z.string(),
    photoAlt: z.string(),
  }),
  clinic: z.object({
    name: z.string(),
    tagline: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    phone: z.string(),
    email: z.string(),
    mapsUrl: z.string(),
    emergencyNumber: z.string().default("112"),
  }),
  booking: z.object({
    consultationFeeInr: z.union([z.string(), z.number()]),
    onlineFeeInr: z.union([z.string(), z.number()]).optional(),
    defaultDurationMinutes: z.number().int().positive().default(20),
    bufferMinutes: z.number().int().min(0).default(10),
    slotStepMinutes: z.number().int().positive().default(20),
    maxAdvanceDays: z.number().int().positive().default(30),
    minAdvanceHours: z.number().int().min(0).default(2),
    workingDays: z.union([z.string(), z.array(z.number())]),
    workingHours: z.union([z.string(), z.object({ start: z.string(), end: z.string() })]),
    timezone: z.string().default("Asia/Kolkata"),
    modes: z.array(z.enum(["in_person", "online"])),
    cancellationPolicyHours: z.number().int().default(12),
    reschedulePolicy: z.string(),
  }),
  services: z.array(serviceSchema),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  avatar: z.object({
    name: z.string(),
    role: z.string(),
    introduction: z.string(),
    disclaimer: z.string(),
  }),
  languages: z.array(z.string()).default(["en"]),
  notifications: z.object({
    reminderLeadHours: z.number().int().default(24),
    templates: z.record(z.string(), z.object({ subject: z.string(), body: z.string() })),
  }),
});

export type ClinicConfig = z.infer<typeof clinicConfigSchema>;

export { PLACEHOLDER, isConfigured } from "./config-shared";
import { isConfigured } from "./config-shared";

let cached: ClinicConfig | null = null;

export function getConfig(): ClinicConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(process.cwd(), "config", "clinic.json"), "utf8");
  const parsed = JSON.parse(raw);
  cached = clinicConfigSchema.parse(parsed);
  return cached;
}

/** Reload config (used by admin when config is edited). */
export function reloadConfig(): ClinicConfig {
  cached = null;
  return getConfig();
}

/** Items the clinic MUST complete before going live. */
export interface LaunchChecklistItem {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

export function getLaunchChecklist(): LaunchChecklistItem[] {
  const cfg = getConfig();
  const d = cfg.doctor;
  const c = cfg.clinic;
  return [
    { key: "speciality", label: "Doctor speciality", done: isConfigured(d.speciality), hint: "Edit config/clinic.json → doctor.speciality" },
    { key: "qualifications", label: "Qualifications (verified only)", done: isConfigured(d.qualifications), hint: "Never publish unverified credentials." },
    { key: "registration", label: "Professional registration details", done: isConfigured(d.registration.council) && isConfigured(d.registration.registrationNumber), hint: "Verify against the state medical council register." },
    { key: "experience", label: "Years of experience", done: isConfigured(d.yearsOfExperience), hint: "Edit config/clinic.json → doctor.yearsOfExperience" },
    { key: "clinicName", label: "Clinic name", done: isConfigured(c.name), hint: "Edit config/clinic.json → clinic.name" },
    { key: "address", label: "Clinic address", done: isConfigured(c.address) && isConfigured(c.city), hint: "Edit config/clinic.json → clinic.address/city/state" },
    { key: "phone", label: "Clinic phone & email", done: isConfigured(c.phone) && isConfigured(c.email), hint: "Edit config/clinic.json → clinic.phone/email" },
    { key: "fee", label: "Consultation fee", done: isConfigured(cfg.booking.consultationFeeInr), hint: "Edit config/clinic.json → booking.consultationFeeInr" },
    { key: "hours", label: "Working days & hours", done: isConfigured(cfg.booking.workingDays) && isConfigured(cfg.booking.workingHours), hint: "Also confirm in Admin → Schedule Management" },
    { key: "google", label: "Google Calendar integration", done: integrationStatus("calendar") === "live", hint: "Set GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CALENDAR_ID (see docs/GOOGLE_SETUP.md)" },
    { key: "sheets", label: "Google Sheets register", done: integrationStatus("sheets") === "live", hint: "Set GOOGLE_SHEETS_SPREADSHEET_ID (see docs/GOOGLE_SETUP.md)" },
    { key: "email", label: "Email notifications (SMTP)", done: integrationStatus("email") === "live", hint: "Set SMTP_* variables (see .env.example)" },
    { key: "avatar", label: "AI receptionist voice/animation provider", done: integrationStatus("avatar") === "live", hint: "Local demo avatar is active; set AVATAR_PROVIDER + keys for full realism (docs/AVATAR_SETUP.md)" },
  ];
}

export function launchReadiness(): { total: number; done: number; ready: boolean } {
  const items = getLaunchChecklist();
  const done = items.filter((i) => i.done).length;
  return { total: items.length, done, ready: done === items.length };
}

/* ------------------------------------------------------------------ */
/* Integration status — derived from server-side environment only      */
/* ------------------------------------------------------------------ */

export type IntegrationStatus = "live" | "demo" | "disabled";

function envSet(...names: string[]): boolean {
  return names.every((n) => {
    const v = process.env[n];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function integrationStatus(kind: "calendar" | "sheets" | "email" | "sms" | "avatar" | "onlineConsult"): IntegrationStatus {
  switch (kind) {
    case "calendar":
    case "sheets":
      // Both need the service account; sheets additionally needs the spreadsheet id.
      if (envSet("GOOGLE_SERVICE_ACCOUNT_JSON")) {
        if (kind === "sheets") return envSet("GOOGLE_SHEETS_SPREADSHEET_ID") ? "live" : "demo";
        return "live";
      }
      return "demo";
    case "email":
      return envSet("SMTP_HOST", "SMTP_USER", "SMTP_PASS") ? "live" : "demo";
    case "sms":
      if (process.env.SMS_NOTIFICATIONS_ENABLED !== "true") return "disabled";
      return envSet("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER") ? "live" : "demo";
    case "avatar":
      return process.env.AVATAR_PROVIDER === "local" ? "demo" : envSet("AVATAR_PROVIDER") ? "live" : "demo";
    case "onlineConsult":
      return process.env.ONLINE_CONSULTATIONS_ENABLED === "false" ? "disabled" : "live";
  }
}

export function demoMode(): boolean {
  return integrationStatus("calendar") !== "live" || integrationStatus("sheets") !== "live";
}
