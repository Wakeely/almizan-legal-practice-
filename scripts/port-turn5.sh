#!/bin/bash
# Port Turn 5 components from reference Vite app to Next.js App Router.
# Faithful copies with import path rewrites + Al Mizan rebrand.

set -e

SRC=/home/z/my-project/reference-ui/extracted/wakeely-ui-reference/components
DST=/home/z/my-project/src/components

REWRITE=(
  -e "s|from '../lib/LanguageContext'|from '@/components/providers/language-provider'|g"
  -e "s|from '../lib/AuthContext'|from '@/components/providers/auth-provider'|g"
  -e "s|from '../types'|from '@/lib/types'|g"
  -e "s|from '../lib/i18n'|from '@/lib/i18n'|g"
  -e "s|from '../lib/offlineStorage'|from '@/lib/offline-storage'|g"
)

port_file() {
  local src_file="$1"
  local dst_file="$2"
  sed "${REWRITE[@]}" "$src_file" > "$dst_file"
  { echo "'use client';"; echo; cat "$dst_file"; } > "$dst_file.tmp" && mv "$dst_file.tmp" "$dst_file"
  echo "  ported: $(basename $src_file) → $dst_file ($(wc -l < $dst_file) lines)"
}

echo "Porting Turn 5 components..."
port_file "$SRC/ConflictCheckModal.tsx"          "$DST/conflict/conflict-check-modal.tsx"
port_file "$SRC/GlobalSearchModal.tsx"           "$DST/search/global-search-modal.tsx"
port_file "$SRC/SubscriptionPaywallModal.tsx"    "$DST/subscription/subscription-paywall-modal.tsx"

# Rebrand Wakeely → Al Mizan in all ported files
for f in "$DST/conflict/conflict-check-modal.tsx" \
         "$DST/search/global-search-modal.tsx" \
         "$DST/subscription/subscription-paywall-modal.tsx"; do
  perl -i -pe 's/Wakeely Pro Legal Operating System/Al Mizan Legal Operating System/g;
               s/Wakeely Pro Legal OS/Al Mizan Legal OS/g;
               s/Wakeely Legal/Al Mizan Legal/g;
               s/Wakeely Redaction/Al Mizan Redaction/g;
               s/Wakeely Workflow/Al Mizan Workflow/g;
               s/Wakeely_Analytics/AlMizan_Analytics/g;
               s/Wakeely Pro/Al Mizan/g;
               s/Wakeely/Al Mizan/g;
               s/واكيلي برو/الميزان/g;
               s/واكيلي/الميزان/g;
               s/wakeely/almizan/g;
               s/WKL-ETH-/AMZ-ETH-/g;' "$f"
done

echo "---verify no Wakeely refs remain---"
grep -nE "Wakeely|واكيلي|wakeely" "$DST"/conflict/*.tsx "$DST"/search/*.tsx "$DST"/subscription/*.tsx 2>&1 | head -5 || echo "  (clean)"
