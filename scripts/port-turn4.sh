#!/bin/bash
# Port Turn 4 components from reference Vite app to Next.js App Router.
# Faithful copies with import path rewrites + Al Mizan rebrand.

set -e

SRC=/home/z/my-project/reference-ui/extracted/wakeely-ui-reference/components
DST=/home/z/my-project/src/components

mkdir -p "$DST/ai" "$DST/war-room" "$DST/client-portal" "$DST/privilege" "$DST/deposition"

REWRITE=(
  -e "s|from '../lib/LanguageContext'|from '@/components/providers/language-provider'|g"
  -e "s|from '../lib/AuthContext'|from '@/components/providers/auth-provider'|g"
  -e "s|from '../types'|from '@/lib/types'|g"
  -e "s|from '../lib/i18n'|from '@/lib/i18n'|g"
  -e "s|from '../lib/offlineStorage'|from '@/lib/offline-storage'|g"
  -e "s|from './DocumentRedactionModal'|from '@/components/documents/document-redaction-modal'|g"
  -e "s|from './DepositionIndexerModule'|from '@/components/deposition/deposition-indexer-module'|g"
  -e "s|from './PrivilegeLogModule'|from '@/components/privilege/privilege-log-module'|g"
  -e "s|from './CourtRulesCalendaringModule'|from '@/components/court-rules/court-rules-calendaring-module'|g"
)

port_file() {
  local src_file="$1"
  local dst_file="$2"
  sed "${REWRITE[@]}" "$src_file" > "$dst_file"
  { echo "'use client';"; echo; cat "$dst_file"; } > "$dst_file.tmp" && mv "$dst_file.tmp" "$dst_file"
  echo "  ported: $(basename $src_file) → $dst_file ($(wc -l < $dst_file) lines)"
}

echo "Porting Turn 4 components..."
port_file "$SRC/AiModule.tsx"                    "$DST/ai/ai-module.tsx"
port_file "$SRC/WarRoomModule.tsx"              "$DST/war-room/war-room-module.tsx"
port_file "$SRC/ClientPortal.tsx"               "$DST/client-portal/client-portal.tsx"
port_file "$SRC/PrivilegeLogModule.tsx"         "$DST/privilege/privilege-log-module.tsx"
port_file "$SRC/DepositionIndexerModule.tsx"    "$DST/deposition/deposition-indexer-module.tsx"

# Remove old stubs (now replaced by real ports)
rm -f "$DST/deposition/deposition-indexer-module.tsx.tmp" 2>/dev/null
rm -f "$DST/privilege/privilege-log-module.tsx.tmp" 2>/dev/null

# Rebrand Wakeely → Al Mizan in all ported files
for f in "$DST/ai/ai-module.tsx" \
         "$DST/war-room/war-room-module.tsx" \
         "$DST/client-portal/client-portal.tsx" \
         "$DST/privilege/privilege-log-module.tsx" \
         "$DST/deposition/deposition-indexer-module.tsx"; do
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
               s/wakeely/almizan/g;' "$f"
done

echo "---verify no Wakeely refs remain---"
grep -nE "Wakeely|واكيلي|wakeely" "$DST"/ai/*.tsx "$DST"/war-room/*.tsx "$DST"/client-portal/*.tsx "$DST"/privilege/*.tsx "$DST"/deposition/*.tsx 2>&1 | head -5 || echo "  (clean)"
