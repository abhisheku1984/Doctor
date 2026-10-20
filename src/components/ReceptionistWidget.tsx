"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import { useLanguage, useLocale } from "./LanguageProvider";

interface Message {
  role: "user" | "assistant";
  text: string;
  cards?: AssistantReply["cards"];
}

type VoiceState = "idle" | "listening" | "speaking" | "loading" | "error" | "disconnected";

interface AssistantReply {
  text: string;
  cards?: Array<{ title: string; body: string; action?: { label: string; payload: string } }>;
  state?: string;
  booking?: { reference: string };
  provider?: string;
  capabilities?: { voice: boolean; lipSync: boolean; animation: boolean; languages: string[]; provider: string; note: string };
}

const STORAGE_KEY = "drxyz_receptionist_open";

export function ReceptionistWidget() {
  const { t, lang } = useLanguage();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [sessionId] = useState(() => `web-${Math.random().toString(36).slice(2, 10)}`);
  const [capabilities, setCapabilities] = useState<AssistantReply["capabilities"]>();
  const [chatState, setChatState] = useState<string>("idle");
  const [pendingCards, setPendingCards] = useState<AssistantReply["cards"]>([]);
  const [pickerDate, setPickerDate] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVoiceSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    setSttSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === "1") setOpen(true);
  }, []);

  // Greet (in the active language) — re-greets when the language changes
  // before any real conversation has started.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/receptionist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, payload: "greet", lang }),
    })
      .then((r) => r.json())
      .then((data: AssistantReply) => {
        if (cancelled || !data?.text) return;
        setMessages((m) => {
          // Only replace an initial greeting; keep an ongoing conversation.
          const onlyGreeting = m.length === 0 || (m.length === 1 && m[0].role === "assistant");
          return onlyGreeting ? [{ role: "assistant", text: data.text.replace(/\*\*/g, "") }] : m;
        });
        setCapabilities(data.capabilities);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, lang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state]);

  const speak = useCallback(
    (text: string) => {
      if (muted || !voiceSupported) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ""));
        u.lang = locale;
        u.rate = 1.0;
        u.onstart = () => setState("speaking");
        u.onend = () => setState((s) => (s === "speaking" ? "idle" : s));
        u.onerror = () => setState("idle");
        utteranceRef.current = u;
        window.speechSynthesis.speak(u);
      } catch {
        setState("idle");
      }
    },
    [muted, voiceSupported, locale]
  );

  const stopSpeech = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
    } catch { /* noop */ }
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || state === "loading") return;
      const clean = text.trim();
      setMessages((m) => [...m, { role: "user", text: clean }]);
      setInput("");
      setState("loading");
      try {
        const res = await fetch("/api/receptionist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: clean, lang }),
        });
        const data: AssistantReply = await res.json();
        const reply = data.text ?? t("rw.errorReply");
        setMessages((m) => [...m, { role: "assistant", text: reply.replace(/\*\*/g, "") }]);
        if (data.capabilities) setCapabilities(data.capabilities);
        setState("idle");
        speak(reply);
      } catch {
        setState("error");
        setMessages((m) => [...m, { role: "assistant", text: t("rw.connectError") }]);
      }
    },
    [sessionId, state, speak, lang, t]
  );

  const onCardAction = useCallback(
    async (label: string, payload: string) => {
      // Show chosen option as user message for context
      setMessages((m) => [...m, { role: "user", text: label }]);
      setPendingCards([]);
      setState("loading");
      try {
        const res = await fetch("/api/receptionist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, payload, lang }),
        });
        const data: AssistantReply = await res.json();
        const reply = data.text ?? "";
        if (reply) setMessages((m) => [...m, { role: "assistant", text: reply.replace(/\*\*/g, "") }]);
        setState("idle");
        speak(reply);
      } catch {
        setState("error");
      }
    },
    [sessionId, speak, lang]
  );

  const handlePayload = useCallback((payload: string) => onCardAction(payload, payload), [onCardAction]);

  const startListening = useCallback(() => {
    if (!sttSupported) return;
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = locale;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => setState("listening");
      rec.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript;
        if (transcript) void send(transcript);
      };
      rec.onerror = () => setState("error");
      rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setState("error");
    }
  }, [send, sttSupported, locale]);

  const restart = useCallback(() => {
    stopSpeech();
    setMessages([]);
    setChatState("idle");
    setPendingCards([]);
    setState("idle");
    void handlePayload("reset");
  }, [handlePayload, stopSpeech]);

  const close = useCallback(() => {
    setOpen(false);
    sessionStorage.setItem(STORAGE_KEY, "0");
    stopSpeech();
    try {
      recognitionRef.current?.stop();
    } catch { /* noop */ }
  }, [stopSpeech]);

  const statusColor: Record<VoiceState, string> = {
    idle: "bg-emerald-500",
    listening: "bg-amber-500",
    speaking: "bg-teal-500",
    loading: "bg-sky-400 animate-pulse",
    error: "bg-red-500",
    disconnected: "bg-slate-400",
  };
  const statusLabel: Record<VoiceState, string> = {
    idle: t("rw.ready"),
    listening: t("rw.listening"),
    speaking: t("rw.speaking"),
    loading: t("rw.thinking"),
    error: t("rw.connIssue"),
    disconnected: t("rw.disconnected"),
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        data-receptionist-toggle="1"
        onClick={() => {
          setOpen((v) => !v);
          sessionStorage.setItem(STORAGE_KEY, open ? "0" : "1");
        }}
        aria-label={t("rw.open")}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lift transition-transform hover:scale-105 focus-visible:outline-none"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
            <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label={t("rw.dialog")}
          className="fixed bottom-24 right-5 z-50 flex h-[540px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-lift sm:bottom-6 sm:right-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-navy-100 bg-navy-950 px-4 py-3 text-white">
            <Avatar size={44} speaking={state === "speaking"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("rw.title")}</p>
              <p className="flex items-center gap-1.5 text-xs text-navy-300">
                <span className={`h-2 w-2 rounded-full ${statusColor[state]}`} aria-hidden="true" />
                {statusLabel[state]}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMuted((m) => !m)}
                aria-pressed={muted}
                aria-label={muted ? t("rw.unmute") : t("rw.mute")}
                className={`rounded-lg p-2 transition-colors ${muted ? "bg-white/20 text-white" : "text-navy-300 hover:bg-white/10 hover:text-white"}`}
              >
                {muted ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
                )}
              </button>
              <button onClick={restart} aria-label={t("rw.restart")} className="rounded-lg p-2 text-navy-300 hover:bg-white/10 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>
              </button>
              <button onClick={close} aria-label={t("rw.close")} className="rounded-lg p-2 text-navy-300 hover:bg-white/10 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="border-b border-navy-100 bg-amber-50 px-4 py-2 text-[11px] leading-snug text-amber-900">
            {t("rw.disclaimer", { num: "112" })}
          </div>

          {/* Messages */}
          <div className="chat-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-teal-600 text-white"
                      : "rounded-bl-md bg-navy-50 text-navy-800"
                  }`}
                >
                  {m.text.split("\n").map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-1" : ""}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {state === "loading" && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-navy-50 px-4 py-3 text-sm text-navy-500">
                  <span className="inline-block animate-pulse">{t("rw.typing")}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice controls */}
          <div className="flex items-center gap-2 border-t border-navy-100 px-4 py-2">
            <button
              onClick={startListening}
              disabled={!sttSupported || state === "listening"}
              aria-label={t("rw.micAria")}
              className={`rounded-lg p-2 transition-colors ${
                state === "listening"
                  ? "bg-amber-100 text-amber-700"
                  : "text-navy-500 hover:bg-navy-50 disabled:opacity-40"
              }`}
              title={sttSupported ? t("rw.micTitle") : t("rw.micUnsupported")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
              </svg>
            </button>
            <button
              onClick={() => setCaptions((c) => !c)}
              aria-pressed={captions}
              className={`rounded-lg p-2 transition-colors ${captions ? "bg-teal-50 text-teal-700" : "text-navy-400 hover:bg-navy-50"}`}
              title={t("rw.captions")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M10 12h.01M14 12h.01M7 15h10" strokeLinecap="round" />
              </svg>
            </button>
            {!voiceSupported && (
              <span className="ml-auto text-[10px] text-navy-400">{t("rw.voiceUnavail")}</span>
            )}
            {capabilities && (
              <span className="ml-auto text-[10px] text-navy-400">
                {capabilities.provider}
                {!capabilities.lipSync ? t("rw.lipSyncNote") : ""}
              </span>
            )}
          </div>

          {/* Input */}
          <form
            className="flex items-center gap-2 border-t border-navy-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="receptionist-input" className="sr-only">{t("rw.inputLabel")}</label>
            <input
              id="receptionist-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("rw.placeholder")}
              className="min-w-0 flex-1 rounded-xl border border-navy-200 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label={t("rw.send")}
              className="rounded-xl bg-teal-600 p-2.5 text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
