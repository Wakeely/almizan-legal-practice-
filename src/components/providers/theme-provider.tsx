"use client";

// =============================================================================
// ThemeProvider — wraps next-themes with the Al Mizan class names.
// The reference ThemeProvider toggles .light/.dark on <html>; next-themes
// does the same with attribute="class" + defaultTheme="dark".
// =============================================================================

import { ThemeProvider as NextThemesProvider } from "next-themes";
import React from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
