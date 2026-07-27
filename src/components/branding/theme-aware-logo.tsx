"use client";

// =============================================================================
// ThemeAwareLogo — renders the white logo in dark mode, dark logo in light mode
// -----------------------------------------------------------------------------
// The user has two logo variants:
//   - /logo-header.svg  (dark teal text — for light backgrounds)
//   - /logo-header-white.png  (white text — for dark backgrounds)
//
// This component uses next-themes to detect the current theme and render the
// correct logo. Falls back to the dark logo during SSR to avoid hydration
// mismatch (the page loads in default theme, then theme is resolved on client).
// =============================================================================

import React from "react";
import { useTheme } from "next-themes";

interface ThemeAwareLogoProps {
  className?: string;
  alt?: string;
}

export default function ThemeAwareLogo({
  className = "h-12 w-auto",
  alt = "Al Mizan Legal Practice",
}: ThemeAwareLogoProps) {
  const { resolvedTheme } = useTheme();
  // Use resolvedTheme (handles system preference) — fall back to "dark" before hydration
  const isDark = resolvedTheme === "dark";

  if (isDark) {
    // White logo for dark backgrounds
    return (
       
      <img
        src="/logo-header-white.png"
        alt={alt}
        className={className}
      />
    );
  }

  // Dark teal logo for light backgrounds
  return (
     
    <img
      src="/logo-header.svg"
      alt={alt}
      className={className}
    />
  );
}
