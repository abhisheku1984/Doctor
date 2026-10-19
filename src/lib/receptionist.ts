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
import { displayDateL, displayTimeL } from "./time";
import { translate, LANG_LOCALES, type Lang, type TranslationKey } from "./i18n";
import { getDb } from "./db";

const L = (lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string =>
  translate(lang, key, vars);
const fmtDate = (dateKey: string, lang: Lang): string => displayDateL(dateKey, LANG_LOCALES[lang]);
const fmtTime = (t: string, lang: Lang): string => displayTimeL(t, LANG_LOCALES[lang]);

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

const MEDICAL_ADVICE_RE = /\b(diagnos|prescribe|prescription|symptom|treatment for|cure|dose|dosage|medicine|tablet|injection|sick|disease|pain in|fever|cough|ache)\b|दवा|इलाज|बीमारी|लक्षण|दर्द|बुखार|निदान|प्रिस्क्रिप्शन|दस्ताने/i;
const EMERGENCY_RE = /\b(emergency|ambulance|accident|chest pain|heart attack|stroke|unconscious|severe bleeding)\b|आपातकाल|इमरजेंसी|एम्बुलेंस|दुर्घटना|हार्ट अटैक|बेहोश/i;

function safetyReply(m: string, lang: Lang): string | null {
  if (EMERGENCY_RE.test(m)) {
    return L(lang, "chat.emergency");
  }
  if (MEDICAL_ADVICE_RE.test(m)) {
    return L(lang, "chat.medical", { doctor: cfg().doctor.name });
  }
  return null;
}

/* --------------------------- Intent detection --------------------------- */

interface Intent {
  name: string;
  patterns: RegExp[];
}

const INTENTS: Intent[] = [
  { name: "greeting", patterns: [/^(hi|hello|hey|good (morning|afternoon|evening)|namaste|namaskar|vanakam)\b/i, /^(नमस्ते|नमस्कार|हैलो|हाय|सुप्रभात)/i, /\b(mr|ms|dr)\b.*\breceptionist\b/i] },
  { name: "book", patterns: [/\b(book|appointment|schedule|reserve|fix.*(slot|appointment)|consult)\b/i, /बुक|अपॉइंटमेंट|एपॉइंटमेंट|नियुक्ति/] },
  { name: "services", patterns: [/\b(services?|treat|speciali[sz]|what do you|offer|provide)\b/i, /सेवा|सेवाएँ|सेवाएं/] },
  { name: "fees", patterns: [/\b(fee|fees|cost|charge|price|₹|rupees?|rate)\b/i, /फीस|शुल्क|कीमत|पैसे/] },
  { name: "timings", patterns: [/\b(time|hour|open|close|when.*(open|available)|working)\b/i, /समय|खुलने|बंद होने|कार्य समय/] },
  { name: "location", patterns: [/\b(address|location|where|direction|map|reach|area|road)\b/i, /पता|कहाँ|कहा है|लोकेशन|रास्ता|नक्शा/] },
  { name: "contact", patterns: [/\b(contact|phone|call|number|email|mail)\b/i, /फोन|नंबर|ईमेल|संपर्क/] },
  { name: "modes", patterns: [/\b(online|in[- ]person|video|virtual|clinic visit|mode)\b/i, /ऑनलाइन|वीडियो|व्यक्तिगत|क्लिनिक में/] },
  { name: "cancellation", patterns: [/\b(cancel|reschedule|postpone|refund|policy)\b/i, /रद्द|कैंसिल|स्थगित|वापसी|नीति/] },
  { name: "qualifications", patterns: [/\b(qualification|experience|degree|md|mbbs|specialist|registration)\b/i, /योग्यता|डिग्री|अनुभव|पंजीकरण/] },
  { name: "status", patterns: [/\b(my appointment|appointment status|reference|booking status)\b/i, /मेरी अपॉइंटमेंट|संदर्भ|स्टेटस/] },
  { name: "thanks", patterns: [/\b(thanks|thank you|thx|great|ok|okay|bye|goodbye)\b/i, /धन्यवाद|शुक्रिया|बाय/] },
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

function timingsText(lang: Lang): string {
  const c = cfg();
  if (!isConfigured(c.booking.workingHours)) {
    return L(lang, "chat.timingsNone");
  }
  const hours = typeof c.booking.workingHours === "string" ? c.booking.workingHours : `${c.booking.workingHours.start}–${c.booking.workingHours.end}`;
  const days = Array.isArray(c.booking.workingDays) ? c.booking.workingDays.join(", ") : String(c.booking.workingDays);
  return L(lang, "chat.timings", { days, hours });
}

function feesText(lang: Lang): string {
  const c = cfg();
  const fee = c.booking.consultationFeeInr;
  const feeTxt = typeof fee === "number" ? `₹${fee}` : fee;
  let s = L(lang, "chat.fees", { fee: feeTxt });
  if (c.booking.onlineFeeInr) s += L(lang, "chat.feesOnline", { fee: typeof c.booking.onlineFeeInr === "number" ? `₹${c.booking.onlineFeeInr}` : c.booking.onlineFeeInr });
  return s;
}

function servicesText(lang: Lang): string {
  const c = cfg();
  return c.services.map((s) => L(lang, "chat.serviceItem", { name: s.name, min: s.durationMinutes })).join("\n");
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

function intro(lang: Lang = "en"): string {
  const c = cfg();
  // English: the clinic-verified introduction from config/clinic.json.
  // Other languages: the reviewed translation of the standard introduction.
  if (lang === "en" && isConfigured(c.avatar.introduction)) return c.avatar.introduction;
  return L(lang, "chat.intro", { doctor: c.doctor.name });
}

async function presentSlots(ctx: ChatContext, lang: Lang): Promise<AssistantReply> {
  const mode = ctx.mode ?? "in_person";
  const days = await getAvailabilityRange(7, mode);
  const cards: AssistantReply["cards"] = [];
  for (const d of days.slice(0, 5)) {
    const free = d.slots.filter((s) => s.available).slice(0, 4);
    if (free.length) {
      cards.push({
        title: fmtDate(d.date, lang),
        body: free.map((s) => fmtTime(s.time, lang)).join(", "),
        action: { label: L(lang, "chat.pickDate", { date: fmtDate(d.date, lang) }), payload: `date:${d.date}` },
      });
    }
  }
  const text = cards.length ? L(lang, "chat.slotsIntro") : L(lang, "chat.slotsNone");
  return { text, cards, state: ctx.state };
}

/* --------------------------- Main handler --------------------------- */

export async function handleMessage(sessionId: string, raw: string, lang: Lang = "en"): Promise<AssistantReply> {
  const ctx = loadContext(sessionId);
  const text = raw.trim();

  // 1) Safety boundaries always win.
  const safety = safetyReply(text, lang);
  if (safety) return { text: safety, state: ctx.state };

  // 2) In-booking flows, interpret answers first.
  switch (ctx.state) {
    case "collect_mode": {
      const mode = /online|video|virtual|ऑनलाइन|वीडियो/i.test(text) ? "online" : /person|clinic|visit|व्यक्तिगत|क्लिनिक/i.test(text) ? "in_person" : undefined;
      if (!mode) return { text: L(lang, "chat.chooseMode"), state: ctx.state };
      ctx.mode = mode;
      ctx.state = "collect_date";
      saveContext(sessionId, ctx);
      return presentSlots({ ...ctx, state: "collect_date" }, lang);
    }
    case "collect_date": {
      const m = text.match(/(\d{4}-\d{2}-\d{2})/) ?? text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (!m) {
        // Allow picking via card payload "date:YYYY-MM-DD"
        const pm = text.match(/date:(\d{4}-\d{2}-\d{2})/);
        if (pm) { ctx.date = pm[1]; }
        else return { text: L(lang, "chat.dateAsk"), state: ctx.state };
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
        return { text: L(lang, "chat.closedDay"), state: ctx.state };
      }
      const free = day.slots.filter((s) => s.available);
      if (!free.length) {
        ctx.state = "collect_date";
        saveContext(sessionId, ctx);
        return {
          text: L(lang, "chat.noFreeSlots", { date: fmtDate(ctx.date, lang) }),
          cards: [{ title: L(lang, "chat.otherDays"), body: L(lang, "chat.askAvailableDates"), action: { label: L(lang, "chat.showNext7"), payload: "show:slots" } }],
          state: ctx.state,
        };
      }
      ctx.slots = day.slots;
      ctx.state = "collect_time";
      saveContext(sessionId, ctx);
      return {
        text: L(lang, "chat.timesOnDate", {
          date: fmtDate(ctx.date, lang),
          times: free.slice(0, 8).map((s) => fmtTime(s.time, lang)).join(", "),
        }),
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
        const hh = h % 12 || 12;
        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      };
      const slot = ctx.slots?.find((s) => s.available && s.time === fmt(minutes));
      if (!slot) {
        return { text: L(lang, "chat.timeUnavailable"), state: ctx.state };
      }
      ctx.time = slot.time;
      ctx.state = "collect_name";
      saveContext(sessionId, ctx);
      return { text: L(lang, "chat.askName"), state: ctx.state };
    }
    case "collect_name": {
      if (text.trim().length < 2) return { text: L(lang, "chat.nameErr"), state: ctx.state };
      ctx.patientName = text.trim().replace(/[<>&"']/g, "");
      ctx.state = "collect_mobile";
      saveContext(sessionId, ctx);
      return { text: L(lang, "chat.askMobile"), state: ctx.state };
    }
    case "collect_mobile": {
      const digits = text.replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(digits)) {
        return { text: L(lang, "chat.mobileErr"), state: ctx.state };
      }
      ctx.patientMobile = digits;
      ctx.state = "collect_email";
      saveContext(sessionId, ctx);
      return { text: L(lang, "chat.askEmail"), state: ctx.state };
    }
    case "collect_email": {
      if (/^(skip|छोड़ें|छोड़ो)$/i.test(text.trim())) {
        ctx.patientEmail = undefined;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) {
        return { text: L(lang, "chat.emailErr"), state: ctx.state };
      } else {
        ctx.patientEmail = text.trim();
      }
      ctx.state = "collect_consent";
      saveContext(sessionId, ctx);
      return {
        text: L(lang, "chat.askConsent"),
        state: ctx.state,
      };
    }
    case "collect_consent": {
      ctx.consentReminders = /^(y|yes|ok|sure|han|haan|हाँ|हा)/i.test(text.trim());
      ctx.state = "review";
      saveContext(sessionId, ctx);
      return buildReview(ctx, lang);
    }
    case "review": {
      if (/^(no|cancel|change|edit|start over)|नहीं|रद्द/i.test(text.trim())) {
        saveContext(sessionId, { state: "idle" });
        return { text: L(lang, "chat.reviewCancel"), state: "idle" };
      }
      if (!/^yes|confirm|ok|book it|proceed|हाँ|हा/i.test(text.trim())) {
        return { text: L(lang, "chat.reviewConfirmAsk"), state: ctx.state };
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
        const joinInfo = appointment.online_link
          ? L(lang, "chat.joinLink", { link: appointment.online_link })
          : appointment.mode === "online"
            ? L(lang, "chat.joinInstructions")
            : L(lang, "chat.venue", { venue: clinicLine() });
        return {
          text: L(lang, "chat.booked", {
            ref: appointment.id,
            doctor: c.doctor.name,
            date: fmtDate(appointment.date, lang),
            time: fmtTime(appointment.time, lang),
            mode: appointment.mode === "online" ? L(lang, "chat.modeOnline") : L(lang, "chat.modeInperson"),
            joinInfo,
          }),
          state: "done",
          booking: { reference: appointment.id },
        };
      } catch (e) {
        if (e instanceof SlotUnavailableError) {
          saveContext(sessionId, { ...ctx, state: "collect_date" });
          const alt = await presentSlots({ ...ctx, state: "collect_date" }, lang);
          return { text: L(lang, "chat.slotTaken"), cards: alt.cards, state: "collect_date" };
        }
        return { text: L(lang, "chat.bookFailed"), state: ctx.state };
      }
    }
  }

  // 3) Free intents
  const intent = detectIntent(text);
  switch (intent) {
    case "greeting":
      return { text: intro(lang), state: "idle" };
    case "book": {
      const modes = cfg().booking.modes;
      const onlineAllowed = modes.includes("online") && integrationStatus("onlineConsult") !== "disabled";
      const opts = onlineAllowed ? L(lang, "chat.bookOptsOnline") : L(lang, "chat.bookOptsInperson");
      const next: ChatContext = { state: "collect_mode", serviceId: cfg().services[0]?.id };
      saveContext(sessionId, next);
      return { text: L(lang, "chat.bookIntro", { doctor: cfg().doctor.name, opts }), state: "collect_mode" };
    }
    case "services":
      return { text: `${L(lang, "chat.servicesList", { doctor: cfg().doctor.name })}\n${servicesText(lang)}`, state: "idle" };
    case "fees":
      return { text: feesText(lang), state: "idle" };
    case "timings":
      return { text: timingsText(lang), state: "idle" };
    case "location":
      return {
        text: isConfigured(cfg().clinic.address)
          ? L(lang, "chat.location", { line: clinicLine() })
          : L(lang, "chat.locationTBP"),
        state: "idle",
      };
    case "contact":
      return {
        text: L(lang, "chat.contact", {
          phone: isConfigured(cfg().clinic.phone) ? cfg().clinic.phone : L(lang, "chat.tbp"),
          email: isConfigured(cfg().clinic.email) ? cfg().clinic.email : L(lang, "chat.tbp"),
        }),
        state: "idle",
      };
    case "modes": {
      const modes = cfg().booking.modes;
      const online = modes.includes("online") && integrationStatus("onlineConsult") !== "disabled";
      return {
        text: L(lang, "chat.modes", { online: online ? L(lang, "chat.modesOnline") : "", minutes: cfg().booking.defaultDurationMinutes }),
        state: "idle",
      };
    }
    case "cancellation":
      return {
        text: L(lang, "chat.cancellation", { policy: cfg().booking.reschedulePolicy, hours: cfg().booking.cancellationPolicyHours }),
        state: "idle",
      };
    case "qualifications": {
      const d = cfg().doctor;
      const quals = isConfigured(d.qualifications) ? d.qualifications.join(", ") : L(lang, "chat.notPublished");
      const reg = isConfigured(d.registration.registrationNumber)
        ? L(lang, "chat.regOk", { council: d.registration.council, number: d.registration.registrationNumber })
        : L(lang, "chat.regTBP");
      return {
        text: L(lang, "chat.qualifications", {
          name: d.name,
          quals,
          reg,
          speciality: isConfigured(d.speciality) ? d.speciality : L(lang, "chat.notPublished"),
        }),
        state: "idle",
      };
    }
    case "status":
      return { text: L(lang, "chat.status"), state: "idle" };
    case "thanks":
      return { text: L(lang, "chat.thanks"), state: "idle" };
    default: {
      const faq = faqMatch(text);
      if (faq) return { text: faq, state: "idle" };
      return {
        text: L(lang, "chat.unknown"),
        state: "idle",
        cards: [
          { title: L(lang, "chat.cardBookTitle"), body: L(lang, "chat.cardBookBody"), action: { label: L(lang, "chat.cardBookAction"), payload: "intent:book" } },
          { title: L(lang, "chat.cardStaffTitle"), body: L(lang, "chat.cardStaffBody"), action: { label: L(lang, "chat.cardStaffAction"), payload: "intent:contact" } },
        ],
      };
    }
  }
}

function buildReview(ctx: ChatContext, lang: Lang): AssistantReply {
  const c = cfg();
  const service = c.services.find((s) => s.id === ctx.serviceId) ?? c.services[0];
  const fee = ctx.mode === "online" && c.booking.onlineFeeInr ? c.booking.onlineFeeInr : c.booking.consultationFeeInr;
  return {
    text: L(lang, "chat.review", {
      doctor: c.doctor.name,
      service: service?.name ?? "",
      mode: ctx.mode === "online" ? L(lang, "chat.modeOnline") : L(lang, "chat.modeInperson"),
      date: ctx.date ? fmtDate(ctx.date, lang) : "",
      time: ctx.time ? fmtTime(ctx.time, lang) : "",
      name: ctx.patientName ?? "",
      mobile: ctx.patientMobile ?? "",
      fee: typeof fee === "number" ? `₹${fee}` : fee,
    }),
    state: "review",
  };
}

/** Card payloads sent by the UI (e.g. "date:2026-10-25", "intent:book"). */
export async function handlePayload(sessionId: string, payload: string, lang: Lang = "en"): Promise<AssistantReply> {
  if (payload.startsWith("date:")) return handleMessage(sessionId, payload.slice(5), lang);
  if (payload === "intent:book") return handleMessage(sessionId, "book an appointment", lang);
  if (payload === "intent:contact") return handleMessage(sessionId, "contact number", lang);
  if (payload === "reset") {
    saveContext(sessionId, { state: "idle" });
    return { text: intro(lang), state: "idle" };
  }
  return handleMessage(sessionId, payload, lang);
}
