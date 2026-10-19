"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Lang, translate } from "@/lib/i18n";

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Parameters<typeof translate>[1]) => string;
}

const Ctx = createContext<LanguageCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("clinic-lang");
    if (saved && ["en", "hi", "te"].includes(saved)) setLangState(saved as Lang);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("clinic-lang", l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: Parameters<typeof translate>[1]) => translate(lang, key), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  return useContext(Ctx);
}
