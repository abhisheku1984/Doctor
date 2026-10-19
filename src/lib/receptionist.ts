/**
 * AI Receptionist conversation engine.
 *
 * Safety-by-design:
 *  - Answers ONLY from verified clinic configuration, approved FAQs,
 *    and the live booking backend. Nothing is fabricated.
 *  - Administrative assistant only — it never diagnoses, prescribes,
 *    or presents itself as Dr. XYZ or a medical professional.
 *  - Medical-advice questions receive a clear boundary + escalation.
 *  - Emergencies are directed to 112 immediately.
 */
import { getConfig, isConfigured, integrationStatus } from "./config";
import { getDayAvailability, getAvailabilityRange, createBooking, SlotUnavailableError, type ConsultMode, type DayAvailability } from "./booking";
import { addDays, displayDate, displayTime, todayKey } from "./time";
import { getDb } from "./db";

export type ChatState =
  | "idle"
  | "collect_mode"
  | "collect_date"
  | "collect_time"
  | "collect_name"
  | "collect_mobile"
  | "collect_email"
  | "collect_consent"
  | "review"
  | "done";

export interface ChatContext {
  state: ChatState;
  mode?: ConsultMode;
  date?: string;
  time?: string;
  serviceId?: string;
  patientName?: string;
  patientMobile?: string;
  patientEmail?: string;
  consentReminders?: boolean;
  slots?: Array<{ time: string; available: boolean }>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface AssistantReply {
  text: string;
  cards?: Array<{ title: string; body: string; action?: { label: string; payload: string } }>;
  state: ChatState;
  booking?: { reference: string };
}

/* --------------------------- Session store --------------------------- */

export function loadContext(sessionId: string): ChatContext {
  const row = getDb().prepare("SELECT context FROM chat_sessions WHERE session_id = ?").get(sessionId) as
    | { context: string }
    | undefined;
  if (!row) return { state: "idle" };
  try {
    return JSON.parse(row.context) as ChatContext;
  } catch {
    return { state: "idle" };
  }
}

function saveContext(sessionId: string, ctx: ChatContext): void {
  getDb()
    .prepare(
      `INSERT INTO chat_sessions (session_id, context, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET context = excluded.context, updated_at = excluded.updated_at`
    )
    .run(sessionId, JSON.stringify(ctx), new Date().toISOString());
}

/* --------------------------- Safety & boundaries --------------------------- */

const MEDICAL_ADVICE_RE = /\b(diagnos|prescribe|prescription|symptom|treatment for|cure|dose|dosage|medicine|tablet|injection|sick|disease|disease|pain in|fever|cough|ache)\b/i;
const EMERGENCY_RE = /\b(emergency|ambulance|accident|chest pain|heart attack|stroke|unconscious|severe bleeding)\b/i;

function safetyReply(m: string): string | null {
  if (EMERGENCY_RE.test(m)) {
    return "If this is a medical emergency, please call 112 (India's emergency number) or visit the nearest hospital immediately — don't wait for a booking. I can only help with appointments and clinic information.";
  }
  if (MEDICAL_ADVICE_RE.test(m)) {
    return "I'm the clinic's virtual receptionist — I can help with appointments, timings, fees and clinic information, but I'm not a medical professional and can't give health advice. Dr. XYZ will address medical questions during your consultation. Would you like to book an appointment?";
  }
  return null;
}

/* --------------------------- Intent detection --------------------------- */

interface Intent {
  name: string;
  patterns: RegExp[];
}

const INTENTS: Intent[] = [
  { name: "greeting", patterns: [/^(hi|hello|hey|good (morning|afternoon|evening)|namaste|namaskar|vanakam)\b/i, /\b(mr|ms|dr)\b.*\breceptionist\b/i] },
  { name: "book", patterns: [/\b(book|appointment|schedule|reserve|fix.*(slot|appointment)|consult)\b/i] },
  { name: "services", patterns: [/\b(services?|treat|speciali[sz]|what do you|offer|provide)\b/i] },
  { name: "fees", patterns: [/\b(fee|fees|cost|charge|price|₹|rupees?|rate)\b/i] },
  { name: "timings", patterns: [/\b(time|hour|open|close|when.*(open|available)|working)\b/i] },
  { name: "location", patterns: [/\b(address|location|where|direction|map|reach|area|road)\b/i] },
  { name: "contact", patterns: [/\b(contact|phone|call|number|email|mail)\b/i] },
  { name: "modes", patterns: [/\b(online|in[- ]person|video|virtual|clinic visit|mode)\b/i] },
  { name: "cancellation", patterns: [/\b(cancel|reschedule|postpone|refund|policy)\b/i] },
  { name: "qualifications", patterns: [/\b(qualification|experience|degree|md|mbbs|specialist|registration)\b/i] },
  { name: "status", patterns: [/\b(my appointment|appointment status|reference|booking status)\b/i] },
  { name: "thanks", patterns: [/\b(thanks|thank you|thx|great|ok|okay|bye|goodbye)\b/i] },
];

function detectIntent(text: string): string {
  for (const intent of INTENTS) {
    for (const p of intent.patterns) {
      if (p.test(text)) return intent.name;
    }
  }
  return "unknown";
}

/* --------------------------- Reply builders --------------------------- */

const cfg = () => getConfig();

function clinicLine(): string {
  const c = cfg();
  const parts: string[] = [];
  if (isConfigured(c.clinic.name)) parts.push(c.clinic.name);
  if (isConfigured(c.clinic.address)) parts.push(c.clinic.address);
  if (isConfigured(c.clinic.city)) parts.push(`${c.clinic.city}, ${c.clinic.state}`);
  return parts.join(" — ");
}

function timingsText(): string {
  const c = cfg();
  if (!isConfigured(c.booking.workingHours)) {
    return "Working hours haven't been published yet — please call the clinic or ask me to book and I'll show live available slots.";
  }
  const hours = typeof c.booking.workingHours === "string" ? c.booking.workingHours : `${c.booking.workingHours.start}–${c.booking.workingHours.end}`;
  const days = Array.isArray(c.booking.workingDays) ? c.booking.workingDays.join(", ") : String(c.booking.workingDays);
  return `The clinic is open on ${days}, ${hours} (Asia/Kolkata).`;
}

function feesText(): string {
  const c = cfg();
  const fee = c.booking.consultationFeeInr;
  const feeTxt = typeof fee === "number" ? `₹${fee}` : fee;
  let s = `The consultation fee is ${feeTxt}.`;
  if (c.booking.onlineFeeInr) s += ` Online consultations: ${typeof c.booking.onlineFeeInr === "number" ? `₹${c.booking.onlineFeeInr}` : c.booking.onlineFeeInr}.`;
  return s;
}

function servicesText(): string {
  const c = cfg();
  return c.services.map((s) => `• ${s.name} (${s.durationMinutes} min)`).join("\n");
}

function faqMatch(text: string): string | null {
  const c = cfg();
  const lower = text.toLowerCase();
  for (const f of c.faqs) {
    const keywords = f.q.toLowerCase().replace(/[?]/g, "").split(/\s+/).filter((w) => w.length > 3);
    // Weighted scoring: long keywords count double; need a strong
    // match so single generic words ("what", "clinic") never
    // hijack unrelated questions.
    const score = keywords.reduce((acc, k) => acc + (lower.includes(k) ? (k.length >= 6 ? 2 : 1) : 0), 0);
    if (score >= 3) return `**${f.q}**\n${f.a}`;
  }
  return null;
}

function intro(): string {
  const a = cfg().avatar;
  return a.introduction;
}

async function presentSlots(ctx: ChatContext): Promise<AssistantReply> {
  const mode = ctx.mode ?? "in_person";
  const days = await getAvailabilityRange(7, mode);
  const cards: AssistantReply["cards"] = [];
  for (const d of days.slice(0, 5)) {
    const free = d.slots.filter((s) => s.available).slice(0, 4);
    if (free.length) {
      cards.push({
        title: displayDate(d.date),
        body: free.map((s) => displayTime(s.time)).join(", "),
        action: { label: `Pick ${displayDate(d.date)}`, payload: `date:${d.date}` },
      });
    }
  }
  const text = cards.length
    ? "Here are the next available slots (all times Asia/Kolkata):"
    : "I couldn't find open slots in the next week. Please try a different consultation mode or call the clinic.";
  return { text, cards, state: ctx.state };
}

/* --------------------------- Main handler --------------------------- */

export async function handleMessage(sessionId: string, raw: string): Promise<AssistantReply> {
  const ctx = loadContext(sessionId);
  const text = raw.trim();

  // 1) Safety boundaries always win.
  const safety = safetyReply(text);
  if (safety) return { text: safety, state: ctx.state };

  // 2) In-booking flows, interpret answers first.
  switch (ctx.state) {
    case "collect_mode": {
      const mode = /online|video|virtual/i.test(text) ? "online" : /person|clinic|visit/i.test(text) ? "in_person" : undefined;
      if (!mode) return { text: "Please choose: **In-person** (at the clinic) or **Online** (video/phone).", state: ctx.state };
      ctx.mode = mode;
      ctx.state = "collect_date";
      saveContext(sessionId, ctx);
      return presentSlots({ ...ctx, state: "collect_date" });
    }
    case "collect_date": {
      const m = text.match(/(\d{4}-\d{2}-\d{2})/) ?? text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (!m) {
        // Allow picking via card payload "date:YYYY-MM-DD"
        const pm = text.match(/date:(\d{4}-\d{2}-\d{2})/);
        if (pm) { ctx.date = pm[1]; }
        else return { text: "Please tell me a date (e.g. 25-10-2026) or pick one from the cards above.", state: ctx.state };
      } else if (m[1] && m[1].includes("-")) {
        ctx.date = m[1];
      } else {
        const [, d, mo, y] = m as RegExpMatchArray;
        const year = y!.length === 2 ? `20${y}` : y!;
        ctx.date = `${year}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
      }
      const day = await getDayAvailability(ctx.date, ctx.mode ?? "in_person");
      if (!day.open) {
        ctx.state = "collect_date";
        saveContext(sessionId, ctx);
        return { text: "The clinic is closed that day. Try another date from the list.", state: ctx.state };
      }
      const free = day.slots.filter((s) => s.available);
      if (!free.length) {
        ctx.state = "collect_date";
        saveContext(sessionId, ctx);
        return { text: `No free slots on ${displayDate(ctx.date)}. Try another date:`, cards: [{ title: "Other days", body: "Ask me for available dates", action: { label: "Show next 7 days", payload: "show:slots" } }], state: ctx.state };
      }
      ctx.slots = day.slots;
      ctx.state = "collect_time";
      saveContext(sessionId, ctx);
      return {
        text: `Available times on ${displayDate(ctx.date)} (Asia/Kolkata): ${free.slice(0, 8).map((s) => displayTime(s.time)).join(", ")}. Please reply with your preferred time (e.g. "10:30 AM").`,
        state: ctx.state,
      };
    }
    case "collect_time": {
      const parsed = text.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
      let minutes = -1;
      if (parsed) {
        let h = parseInt(parsed[1], 10);
        const mins = parseInt(parsed[2] || "0", 10);
        const ap = parsed[3];
        if (ap === "pm" && h < 12) h += 12;
        if (ap === "am" && h === 12) h = 0;
        minutes = h * 60 + mins;
      } else {
        const m24 = text.match(/^(\d{1,2}):(\d{2})$/);
        if (m24) minutes = parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
      }
      const fmt = (n: number) => {
        const h = Math.floor(n / 60);
        const mm = n % 60;
        const ap = h >= 12 ? "PM" : "AM";
        const hh = h % 12 || 12;
        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      };
      const slot = ctx.slots?.find((s) => s.available && s.time === fmt(minutes));
      if (!slot) {
        return { text: "That time isn't available. Choose one of the listed times, or say 'show other days'.", state: ctx.state };
      }
      ctx.time = slot.time;
      ctx.state = "collect_name";
      saveContext(sessionId, ctx);
      return { text: "Great. What is the patient's full name?", state: ctx.state };
    }
    case "collect_name": {
      if (text.trim().length < 2) return { text: "Please provide the patient's full name.", state: ctx.state };
      ctx.patientName = text.trim().replace(/[<>&"']/g, "");
      ctx.state = "collect_mobile";
      saveContext(sessionId, ctx);
      return { text: "And the patient's 10-digit Indian mobile number? (Used only for appointment updates.)", state: ctx.state };
    }
    case "collect_mobile": {
      const digits = text.replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(digits)) {
        return { text: "Please enter a valid 10-digit Indian mobile number (starts with 6–9).", state: ctx.state };
      }
      ctx.patientMobile = digits;
      ctx.state = "collect_email";
      saveContext(sessionId, ctx);
      return { text: "Optional: an email address for the confirmation (or reply 'skip').", state: ctx.state };
    }
    case "collect_email": {
      if (/^skip$/i.test(text.trim())) {
        ctx.patientEmail = undefined;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) {
        return { text: "That email doesn't look right — reply with a valid email or 'skip'.", state: ctx.state };
      } else {
        ctx.patientEmail = text.trim();
      }
      ctx.state = "collect_consent";
      saveContext(sessionId, ctx);
      return {
        text: "May we send appointment reminders to this mobile number? (yes/no)",
        state: ctx.state,
      };
    }
    case "collect_consent": {
      ctx.consentReminders = /^(y|yes|ok|sure|han|haan)/i.test(text.trim());
      ctx.state = "review";
      saveContext(sessionId, ctx);
      return buildReview(ctx);
    }
    case "review": {
      if (/^(no|cancel|change|edit|start over)/i.test(text.trim())) {
        saveContext(sessionId, { state: "idle" });
        return { text: "No problem — booking cancelled. Tell me whenever you'd like to start again.", state: "idle" };
      }
      if (!/^yes|confirm|ok|book it|proceed/i.test(text.trim())) {
        return { text: "Please reply **Yes** to confirm the booking, or **No** to start over.", state: ctx.state };
      }
      // 9) Confirm ONLY after the backend confirms success.
      try {
        const appointment = await createBooking(
          {
            patientName: ctx.patientName!,
            patientMobile: ctx.patientMobile!,
            patientEmail: ctx.patientEmail,
            isNewPatient: true,
            mode: ctx.mode ?? "in_person",
            serviceId: ctx.serviceId ?? cfg().services[0].id,
            date: ctx.date!,
            time: ctx.time!,
            consentReminders: ctx.consentReminders ?? false,
          },
          `chat-${sessionId}-${Date.now()}`
        );
        saveContext(sessionId, { state: "done" });
        const c = cfg();
        return {
          text: `✅ Booking confirmed! Reference **${appointment.id}** — ${c.doctor.name}, ${displayDate(appointment.date)} at ${displayTime(appointment.time)} (${appointment.mode === "online" ? "online" : "in-person"}). ${appointment.online_link ? `Join here: ${appointment.online_link}` : appointment.mode === "online" ? "Joining instructions will be sent separately." : `Venue: ${clinicLine()}`} Reply "done" to finish.`,
          state: "done",
          booking: { reference: appointment.id },
        };
      } catch (e) {
        if (e instanceof SlotUnavailableError) {
          saveContext(sessionId, { ...ctx, state: "collect_date" });
          const alt = await presentSlots({ ...ctx, state: "collect_date" });
          return { text: "Sorry — that slot was just taken by someone else. Here are current alternatives:", cards: alt.cards, state: "collect_date" };
        }
        return { text: "I couldn't complete the booking just now. Please try again shortly or call the clinic.", state: ctx.state };
      }
    }
  }

  // 3) Free intents
  const intent = detectIntent(text);
  switch (intent) {
    case "greeting":
      return { text: intro(), state: "idle" };
    case "book": {
      const modes = cfg().booking.modes;
      const onlineAllowed = modes.includes("online") && integrationStatus("onlineConsult") !== "disabled";
      const opts = onlineAllowed
        ? "Would you like an **In-person** visit at the clinic or an **Online** consultation?"
        : "We currently offer **in-person** consultations at the clinic. Shall we book one?";
      const next: ChatContext = { state: "collect_mode", serviceId: cfg().services[0]?.id };
      saveContext(sessionId, next);
      return { text: `I'd be happy to help you book with ${cfg().doctor.name}. ${opts}`, state: "collect_mode" };
    }
    case "services":
      return { text: `Services offered by ${cfg().doctor.name}:\n${servicesText()}`, state: "idle" };
    case "fees":
      return { text: feesText(), state: "idle" };
    case "timings":
      return { text: timingsText(), state: "idle" };
    case "location":
      return {
        text: isConfigured(cfg().clinic.address)
          ? `You'll find us at: ${clinicLine()}.`
          : "The clinic address hasn't been published yet — please call the clinic for directions.",
        state: "idle",
      };
    case "contact":
      return {
        text: `Phone: ${isConfigured(cfg().clinic.phone) ? cfg().clinic.phone : "[to be published]"} · Email: ${isConfigured(cfg().clinic.email) ? cfg().clinic.email : "[to be published]"}`,
        state: "idle",
      };
    case "modes": {
      const modes = cfg().booking.modes;
      const online = modes.includes("online") && integrationStatus("onlineConsult") !== "disabled";
      return {
        text: `Consultation modes: **In-person** at the clinic${online ? " and **Online** (video/phone)" : ""}. Each consultation is ${cfg().booking.defaultDurationMinutes} minutes.`,
        state: "idle",
      };
    }
    case "cancellation":
      return {
        text: `Cancellation & rescheduling: ${cfg().booking.reschedulePolicy} Cancellations within ${cfg().booking.cancellationPolicyHours} hours of the appointment may be charged. You can cancel or reschedule yourself with your appointment reference and registered mobile number on our website.`,
        state: "idle",
      };
    case "qualifications": {
      const d = cfg().doctor;
      const quals = isConfigured(d.qualifications) ? d.qualifications.join(", ") : "not yet published";
      const reg = isConfigured(d.registration.registrationNumber) ? `Registration: ${d.registration.council} ${d.registration.registrationNumber}` : "Registration details to be published";
      return { text: `${d.name} — Qualifications: ${quals}. ${reg}. Speciality: ${isConfigured(d.speciality) ? d.speciality : "to be published"}.`, state: "idle" };
    }
    case "status":
      return { text: "To check an appointment, share the booking reference (e.g. APT-XXXX) and the registered mobile number on our Appointment Lookup page. For security, I can't look it up here.", state: "idle" };
    case "thanks":
      return { text: "You're welcome! Is there anything else I can help with?", state: "idle" };
    default: {
      const faq = faqMatch(text);
      if (faq) return { text: faq, state: "idle" };
      return {
        text: "I don't have a verified answer for that. Let me connect you with the clinic staff — you can also call the clinic directly. Meanwhile I can help with booking, timings, fees, location and policies.",
        state: "idle",
        cards: [
          { title: "Book an appointment", body: "Guided booking with live availability", action: { label: "Start booking", payload: "intent:book" } },
          { title: "Talk to staff", body: "Call the clinic for anything medical or urgent", action: { label: "Call clinic", payload: "intent:contact" } },
        ],
      };
    }
  }
}

function buildReview(ctx: ChatContext): AssistantReply {
  const c = cfg();
  const service = c.services.find((s) => s.id === ctx.serviceId) ?? c.services[0];
  const fee = ctx.mode === "online" && c.booking.onlineFeeInr ? c.booking.onlineFeeInr : c.booking.consultationFeeInr;
  return {
    text: [
      "Please review your booking:",
      `• Doctor: ${c.doctor.name}`,
      `• Service: ${service?.name ?? ""}`,
      `• Mode: ${ctx.mode === "online" ? "Online consultation" : "In-person consultation"}`,
      `• Date & time: ${ctx.date ? displayDate(ctx.date) : ""} at ${ctx.time ? displayTime(ctx.time) : ""} (Asia/Kolkata)`,
      `• Patient: ${ctx.patientName}`,
      `• Mobile: ${ctx.patientMobile}`,
      `• Fee: ${typeof fee === "number" ? `₹${fee}` : fee}`,
      "Reply **Yes** to confirm or **No** to start over.",
    ].join("\n"),
    state: "review",
  };
}

/** Card payloads sent by the UI (e.g. "date:2026-10-25", "intent:book"). */
export async function handlePayload(sessionId: string, payload: string): Promise<AssistantReply> {
  const ctx = loadContext(sessionId);
  if (payload.startsWith("date:")) return handleMessage(sessionId, payload.slice(5));
  if (payload === "intent:book") return handleMessage(sessionId, "book an appointment");
  if (payload === "intent:contact") return handleMessage(sessionId, "contact number");
  if (payload === "reset") {
    saveContext(sessionId, { state: "idle" });
    return { text: intro(), state: "idle" };
  }
  return handleMessage(sessionId, payload);
}
