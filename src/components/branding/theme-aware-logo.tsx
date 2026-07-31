"use client";

// =============================================================================
// ThemeAwareLogo — renders the user's actual logo, theme-aware
// -----------------------------------------------------------------------------
// Uses two variants of the user's logo (both transparent PNGs):
//   - /logo-header-white.png  (white text — for dark backgrounds)
//   - /logo-header-dark.png   (dark slate text — for light backgrounds)
// =============================================================================

import React from "react";
import { useTheme } from "@/components/providers/theme-provider";

interface ThemeAwareLogoProps {
  className?: string;
  alt?: string;
}

export default function ThemeAwareLogo({
  className = "h-12 w-auto",
  alt = "Al Mizan Legal Practice",
}: ThemeAwareLogoProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
     
    <img
      src={isDark ? "/logo-header-white.png" : "/logo-header-dark.png"}
      alt={alt}
      className={className}
    />
  );
}
