/**
 * Client-safe config helpers (no Node-only imports) — usable from both
 * server code and "use client" components.
 */

export const TIMEZONE = "Asia/Kolkata";

export const PLACEHOLDER = "[TO BE CONFIGURED]";
const PLACEHOLDER_RE = /\[TO BE (CONFIGURED|VERIFIED)\]/i;

/**
 * A field is "configured" when it holds real data (not a [TO BE CONFIGURED]
 * placeholder). Placeholders are never presented as real credentials.
 */
export function isConfigured(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0 && !PLACEHOLDER_RE.test(value);
  if (Array.isArray(value)) return value.length > 0 && value.every(isConfigured);
  return true;
}
