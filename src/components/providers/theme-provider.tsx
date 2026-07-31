"use client";

// =============================================================================
// ThemeProvider — minimal dark/light theme context for Al Mizan.
// -----------------------------------------------------------------------------
// Replaces next-themes: toggles .dark/.light on <html> via attribute="class".
// No inline <script> is rendered (next-themes emits one, which React 19.2+
// flags as an error: "Encountered a script tag while rendering React
// component"). The class is applied in a layout effect instead, so hydration
// stays clean. Defaults to "dark" (matching the original next-themes config).
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface ThemeContextValue {
  theme: string;
  setTheme: (theme: string) => void;
  resolvedTheme: string;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "almizan_theme";

function getInitialTheme(): string {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

function applyThemeClass(theme: string) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<string>(getInitialTheme);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = useCallback((next: string) => {
    const value = next === "light" ? "light" : "dark";
    setThemeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const resolvedTheme = theme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: "dark", setTheme: () => {}, resolvedTheme: "dark" };
  }
  return ctx;
}
