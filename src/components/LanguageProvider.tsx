"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Lang, TranslationKey, translate, isLang, availableLangs, LANG_LOCALES } from "@/lib/i18n";

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LanguageCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

/** Browser-tab titles per route (the visible UI is fully localized). */
const TITLE_BY_PATH: Array<[RegExp, TranslationKey]> = [
  [/^\/$/, "title.home"],
  [/^\/about/, "title.about"],
  [/^\/services/, "title.services"],
  [/^\/book/, "title.book"],
  [/^\/contact/, "title.contact"],
  [/^\/appointments\/lookup/, "title.lookup"],
  [/^\/booking\/confirmation/, "title.confirm"],
  [/^\/privacy/, "title.privacy"],
  [/^\/terms/, "title.terms"],
  [/^\/admin\/login/, "title.adminLogin"],
  [/^\/admin/, "title.admin"],
];

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("clinic-lang");
    if (isLang(saved)) setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("clinic-lang", l);
    document.documentElement.lang = l;
  }, []);

  // Keep <html lang> and the tab title in sync with the chosen language.
  useEffect(() => {
    document.documentElement.lang = lang;
    const entry = TITLE_BY_PATH.find(([re]) => re.test(pathname ?? ""));
    if (entry) document.title = translate(lang, entry[1]);
  }, [lang, pathname]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang]
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  return useContext(Ctx);
}

/** Locale string (e.g. "hi-IN") for formatting dates/times in the UI. */
export function useLocale(): string {
  return LANG_LOCALES[useContext(Ctx).lang];
}
