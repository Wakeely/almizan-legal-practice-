#!/bin/bash
# Convert landing-page.tsx from dark theme to light theme.
# Strategic color swaps: dark slate backgrounds → light, light text → dark text.
# Brand accent colors (indigo, amber, emerald) are darkened for contrast on light bg.

set -e

FILE=/home/z/my-project/src/components/landing/landing-page.tsx

# Order matters — more specific patterns first (e.g. bg-slate-950/90 before bg-slate-950)
perl -i -pe '
  # Backgrounds with opacity (most specific first)
  s/bg-slate-950\/90/bg-white\/90/g;
  s/bg-slate-950\/70/bg-white\/70/g;
  s/bg-slate-950/bg-slate-50/g;
  s/bg-slate-900\/90/bg-white\/90/g;
  s/bg-slate-900\/80/bg-white\/80/g;
  s/bg-slate-900\/50/bg-slate-100\/50/g;
  s/bg-slate-900\/30/bg-slate-100\/30/g;
  s/bg-slate-900\/20/bg-slate-100\/20/g;
  s/bg-slate-900/bg-white/g;
  s/bg-slate-800\/80/bg-slate-200\/80/g;
  s/bg-slate-800\/60/bg-slate-200\/60/g;
  s/bg-slate-800\/40/bg-slate-200\/40/g;
  s/bg-slate-800\/20/bg-slate-200\/20/g;
  s/bg-slate-800/bg-slate-200/g;
  s/bg-slate-950\/95/bg-white\/95/g;

  # Borders
  s/border-slate-800\/90/border-slate-200\/90/g;
  s/border-slate-800\/80/border-slate-200\/80/g;
  s/border-slate-800\/60/border-slate-200\/60/g;
  s/border-slate-800\/50/border-slate-200\/50/g;
  s/border-slate-800/border-slate-200/g;
  s/border-slate-700\/80/border-slate-300\/80/g;
  s/border-slate-700/border-slate-300/g;
  s/border-slate-600/border-slate-400/g;

  # Text colors — convert light-on-dark to dark-on-light
  s/text-slate-100/text-slate-900/g;
  s/text-slate-200/text-slate-800/g;
  s/text-slate-300/text-slate-700/g;
  s/text-slate-400/text-slate-500/g;
  s/text-white/text-slate-900/g;

  # Accent text colors — darken for contrast on light bg
  s/text-indigo-400/text-indigo-600/g;
  s/text-indigo-300/text-indigo-700/g;
  s/text-indigo-200/text-indigo-100/g;  # keep light — used on indigo button bg
  s/text-amber-400/text-amber-600/g;
  s/text-amber-300/text-amber-600/g;
  s/text-emerald-400/text-emerald-600/g;
  s/text-emerald-300/text-emerald-700/g;
  s/text-rose-400/text-rose-600/g;
  s/text-rose-300/text-rose-700/g;

  # Hover text colors
  s/hover:text-white/hover:text-slate-900/g;

  # Gradients
  s/from-indigo-900\/40/from-indigo-100\/40/g;
  s/from-indigo-900/from-indigo-50/g;
  s/to-slate-900/to-slate-100/g;
  s/via-slate-900/via-slate-100/g;

  # Shadows — soften for light bg
  s/shadow-indigo-900\/30/shadow-indigo-300\/30/g;
  s/shadow-indigo-500\/20/shadow-indigo-400\/30/g;

  # Selection colors
  s/selection:bg-indigo-500/selection:bg-indigo-200/g;
  s/selection:text-white/selection:text-indigo-900/g;

  # Mock window elements (the fake browser chrome in the hero preview)
  s/bg-rose-500\/80/bg-rose-400/g;
  s/bg-amber-500\/80/bg-amber-400/g;
  s/bg-emerald-500\/80/bg-emerald-400/g;
' "$FILE"

echo "Color conversion complete."
echo "---verify no dark colors remain (excluding button gradients which stay)---"
grep -nE "bg-slate-950|bg-slate-900|text-slate-100|text-slate-200|text-slate-300" "$FILE" | head -10 || echo "  (clean)"
