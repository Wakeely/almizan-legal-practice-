"use client";

// =============================================================================
// LanguageProvider — bilingual Arabic/English with RTL support
// Faithful port of reference/lib/LanguageContext.tsx adapted to Next.js App
// Router. Persists language choice in localStorage and sets <html dir=...>.
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Language, TranslationDict, translations } from "@/lib/i18n";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationDict;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer — reads localStorage on the client only. The server
  // returns 'en' (default). Hydration mismatch on <html lang> is suppressed
  // via suppressHydrationWarning in app/layout.tsx.
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const saved = localStorage.getItem("almizan_lang") as Language | null;
      if (saved === "ar" || saved === "en") return saved;
    } catch {
      /* ignore */
    }
    return "en";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("almizan_lang", lang);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ar" ? "en" : "ar");
  }, [language, setLanguage]);

  const t = translations[language];
  const isRtl = language === "ar";

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRtl]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
