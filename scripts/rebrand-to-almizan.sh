#!/bin/bash
# =============================================================================
# Rebrand: Wakeely Pro → Al Mizan Legal Practice
# -----------------------------------------------------------------------------
# Replaces all "Wakeely Pro" / "واكيلي برو" / "wakeely" references with
# "Al Mizan" / "الميزان" / "almizan" across the codebase.
#
# Order matters — longer/more-specific matches run FIRST so they don't get
# shadowed by the shorter catch-all rule.
# =============================================================================

set -e

FILES=(
  "/home/z/my-project/src/components/landing/landing-page.tsx"
  "/home/z/my-project/src/components/providers/theme-provider.tsx"
  "/home/z/my-project/src/components/providers/language-provider.tsx"
  "/home/z/my-project/src/components/auth/auth-modal.tsx"
  "/home/z/my-project/src/lib/i18n.ts"
  "/home/z/my-project/src/lib/org.ts"
  "/home/z/my-project/src/lib/types.ts"
  "/home/z/my-project/src/lib/audit.ts"
  "/home/z/my-project/src/lib/session.ts"
  "/home/z/my-project/src/lib/rate-limit.ts"
  "/home/z/my-project/src/lib/validation/auth.ts"
  "/home/z/my-project/src/lib/auth-options.ts"
  "/home/z/my-project/src/lib/password.ts"
  "/home/z/my-project/src/app/api/auth/[...nextauth]/route.ts"
  "/home/z/my-project/src/app/page.tsx"
  "/home/z/my-project/src/app/globals.css"
)

# Order: longer/specific first → catch-all last.
# Using `|` as delimiter since paths don't contain it.
SUBS=(
  # Domains + email placeholders
  "app.wakeelypro.law|app.almizan.legal"
  "advocate@wakeely.law|advocate@almizan.legal"
  "counsel@firm.law|counsel@almizan.legal"   # placeholder in auth-modal.tsx

  # Compound English names
  "Wakeely Pro Legal AI Draft Generated|Al Mizan Legal AI Draft Generated"
  "Wakeely Pro AI Legal System|Al Mizan AI Legal System"
  "LegalWakeely SCCA|AlMizan SCCA"
  "Wakeely Pro System|Al Mizan System"
  "Wakeely Pro —|Al Mizan —"
  "Wakeely Pro\\.|Al Mizan."   # copyright dot suffix
  "Wakeely Pro|Al Mizan"

  # Compound Arabic names
  "محرك الذكاء الاصطناعي لواكيلي برو|محرك الذكاء الاصطناعي للميزان"
  "نظام واكيلي برو|نظام الميزان"
  "واكيلي برو AI|الميزان AI"
  "واكيلي برو|الميزان"

  # Cookie names (lowercase)
  "wakeely.session-token|almizan.session-token"
  "wakeely.callback-url|almizan.callback-url"
  "wakeely.csrf-token|almizan.csrf-token"

  # localStorage keys
  "wakeely_lang|almizan_lang"
  "wakeely_theme|almizan_theme"

  # Comments / doc strings (lowercase)
  "wakeely pro|al mizan"
  "wakeely|almizan"
)

for f in "${FILES[@]}"; do
  for sub in "${SUBS[@]}"; do
    # Split on first `|` to get pattern + replacement
    pat="${sub%%|*}"
    rep="${sub#*|}"
    # Use perl for non-greedy + accurate string replacement (no regex special chars in our patterns)
    perl -i -pe "s/\Q$pat\E/$rep/g" "$f"
  done
done

echo "Rebrand complete. Verifying no Wakeely references remain:"
grep -rn -E "Wakeely|واكيلي|wakeely" "${FILES[@]}" || echo "  (none — clean)"
