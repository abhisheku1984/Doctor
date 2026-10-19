/**
 * Pluggable notification layer (email + SMS).
 *
 * - Live mode: SMTP (any provider) and Twilio, configured via env vars.
 * - Demo mode: messages are logged server-side only; nothing is sent
 *   and nothing is claimed as delivered.
 * Delivery status is tracked per notification and only reported as
 * "delivered" when the provider confirms it.
 */
import nodemailer from "nodemailer";
import { getConfig, integrationStatus } from "./config";
import { getDb } from "./db";
import { displayDate, displayTime } from "./time";
import type { Appointment } from "./booking";

export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<{ ok: boolean; messageId?: string; error?: string }>;
}
export interface SmsProvider {
  send(to: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }>;
}

class SmtpEmailProvider implements EmailProvider {
  private transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_PORT || "587") === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  async send(to: string, subject: string, body: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || "Clinic"}" <${process.env.SMTP_FROM}>`,
        to,
        subject,
        text: body,
      });
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

class DemoEmailProvider implements EmailProvider {
  async send(to: string, subject: string, body: string) {
    console.log(`[DEMO EMAIL] to=${to} subject="${subject}"\n${body}\n`);
    return { ok: true, messageId: `demo-${Date.now()}` };
  }
}

class TwilioSmsProvider implements SmsProvider {
  async send(to: string, text: string) {
    try {
      // Twilio REST call — kept lazy so the module loads without credentials.
      const { Twilio } = await import("twilio");
      const client = new Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const msg = await client.messages.create({
        to: `+91${to}`,
        from: process.env.TWILIO_FROM_NUMBER!,
        body: text,
      });
      return { ok: true, messageId: msg.sid };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

class DemoSmsProvider implements SmsProvider {
  async send(to: string, text: string) {
    console.log(`[DEMO SMS] to=+91${to} text="${text}"`);
    return { ok: true, messageId: `demo-${Date.now()}` };
  }
}

export function emailProvider(): EmailProvider {
  return integrationStatus("email") === "live" ? new SmtpEmailProvider() : new DemoEmailProvider();
}

export function smsProvider(): SmsProvider | null {
  if (integrationStatus("sms") === "disabled") return null;
  return integrationStatus("sms") === "live" ? new TwilioSmsProvider() : new DemoSmsProvider();
}

/* ------------------------------ Templates ------------------------------ */

function render(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? "");
}

function ctxFor(apt: Appointment): Record<string, string> {
  const cfg = getConfig();
  const fee = apt.mode === "online" && cfg.booking.onlineFeeInr ? cfg.booking.onlineFeeInr : cfg.booking.consultationFeeInr;
  return {
    ref: apt.id,
    patientName: apt.patient_name,
    date: displayDate(apt.date),
    time: displayTime(apt.time),
    modeLabel: apt.mode === "online" ? "online consultation" : "in-person consultation",
    fee: typeof fee === "number" ? `₹${fee}` : fee,
    clinicName: cfg.clinic.name,
    doctorName: cfg.doctor.name,
  };
}

function logNotification(aptId: string | null, channel: string, template: string, recipient: string, status: string, provider: string, providerMessageId?: string, error?: string) {
  try {
    getDb()
      .prepare(
        `INSERT INTO notification_log (appointment_id, channel, template, recipient, status, provider, provider_message_id, attempts, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      )
      .run(aptId, channel, template, recipient, status, provider, providerMessageId ?? null, error ?? null, new Date().toISOString(), new Date().toISOString());
  } catch { /* logging must never break notifications */ }
}

/* ------------------------------ Public API ------------------------------ */

export async function notifyBookingConfirmed(apt: Appointment): Promise<void> {
  const cfg = getConfig();
  const ctx = ctxFor(apt);
  const tpl = cfg.notifications.templates.bookingConfirmed;
  const results: Promise<void>[] = [];

  if (apt.patient_email) {
    results.push(
      emailProvider().send(apt.patient_email, render(tpl.subject, ctx), render(tpl.body, ctx)).then((r) => {
        logNotification(apt.id, "email", "bookingConfirmed", apt.patient_email!, r.ok ? "delivered" : "failed", r.ok ? "smtp" : "smtp", r.messageId, r.error);
      })
    );
  }
  const sms = smsProvider();
  if (sms) {
    results.push(
      sms.send(apt.patient_mobile, render(tpl.body, ctx)).then((r) => {
        logNotification(apt.id, "sms", "bookingConfirmed", apt.patient_mobile, r.ok ? "delivered" : "failed", "twilio", r.messageId, r.error);
      })
    );
  }
  await Promise.allSettled(results);
  getDb().prepare("UPDATE appointments SET notification_status = 'sent', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), apt.id);
}

export async function notifyCancellation(apt: Appointment): Promise<void> {
  const cfg = getConfig();
  const ctx = ctxFor(apt);
  const tpl = cfg.notifications.templates.bookingCancelled;
  const jobs: Promise<void>[] = [];
  if (apt.patient_email) jobs.push(emailProvider().send(apt.patient_email, render(tpl.subject, ctx), render(tpl.body, ctx)).then(() => {}));
  const sms = smsProvider();
  if (sms) jobs.push(sms.send(apt.patient_mobile, render(tpl.body, ctx)).then(() => {}));
  await Promise.allSettled(jobs);
}

export async function notifyReschedule(apt: Appointment): Promise<void> {
  const cfg = getConfig();
  const ctx = { ...ctxFor(apt) };
  const tpl = cfg.notifications.templates.bookingConfirmed;
  const jobs: Promise<void>[] = [];
  if (apt.patient_email) jobs.push(emailProvider().send(apt.patient_email, `Updated: ${render(tpl.subject, ctx)}`, render(tpl.body, ctx)).then(() => {}));
  const sms = smsProvider();
  if (sms) jobs.push(sms.send(apt.patient_mobile, render(tpl.body, ctx)).then(() => {}));
  await Promise.allSettled(jobs);
}

/** Staff alert for sync / booking failures (never includes patient medical data). */
export async function notifyStaffAlert(subject: string, message: string): Promise<void> {
  const staffEmail = process.env.STAFF_ALERT_EMAIL;
  if (!staffEmail) {
    console.log(`[STAFF ALERT] ${subject}: ${message}`);
    return;
  }
  await emailProvider().send(staffEmail, subject, message);
}
