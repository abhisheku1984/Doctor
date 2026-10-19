/**
 * Server-side Google service-account authentication.
 * Credentials come ONLY from environment variables — never from
 * browser code or the public clinic config.
 */
import { google } from "googleapis";

export interface GoogleAuthResult {
  jwt: InstanceType<typeof google.auth.JWT> | null;
  configured: boolean;
  error?: string;
}

export function getGoogleAuth(scopes: string[]): GoogleAuthResult {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) return { jwt: null, configured: false };
  try {
    const key = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!key.client_email || !key.private_key) {
      return { jwt: null, configured: false, error: "Service account JSON is missing client_email or private_key." };
    }
    const jwt = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes,
    });
    return { jwt, configured: true };
  } catch (e) {
    return { jwt: null, configured: false, error: `Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${(e as Error).message}` };
  }
}

export const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
export const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
