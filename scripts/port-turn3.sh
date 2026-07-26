#!/bin/bash
# Port Turn 3 components from reference Vite app to Next.js App Router.
# Faithful copies with import path rewrites only.

set -e

SRC=/home/z/my-project/reference-ui/extracted/wakeely-ui-reference/components
DST=/home/z/my-project/src/components

mkdir -p "$DST/documents" "$DST/billing" "$DST/calendar" "$DST/court-rules" "$DST/print" "$DST/deposition" "$DST/privilege"

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

echo "Porting Turn 3 components..."
port_file "$SRC/DocumentsModule.tsx"            "$DST/documents/documents-module.tsx"
port_file "$SRC/DocumentRedactionModal.tsx"    "$DST/documents/document-redaction-modal.tsx"
port_file "$SRC/BillingModule.tsx"             "$DST/billing/billing-module.tsx"
port_file "$SRC/CalendarModule.tsx"            "$DST/calendar/calendar-module.tsx"
port_file "$SRC/CourtRulesCalendaringModule.tsx" "$DST/court-rules/court-rules-calendaring-module.tsx"
port_file "$SRC/PrintPreviewModal.tsx"         "$DST/print/print-preview-modal.tsx"

# Rebrand Wakeely → Al Mizan in all ported files
for f in "$DST/documents/documents-module.tsx" \
         "$DST/documents/document-redaction-modal.tsx" \
         "$DST/billing/billing-module.tsx" \
         "$DST/calendar/calendar-module.tsx" \
         "$DST/court-rules/court-rules-calendaring-module.tsx" \
         "$DST/print/print-preview-modal.tsx"; do
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

# Create stubs for Turn 4 modules referenced by DocumentsModule
cat > "$DST/deposition/deposition-indexer-module.tsx" << 'STUB'
"use client";
import React from "react";
// STUB — real DepositionIndexerModule ships in Turn 4
export default function DepositionIndexerModule() { return null; }
STUB

cat > "$DST/privilege/privilege-log-module.tsx" << 'STUB'
"use client";
import React from "react";
// STUB — real PrivilegeLogModule ships in Turn 4
export default function PrivilegeLogModule() { return null; }
STUB

echo "---verify no Wakeely refs remain---"
grep -nE "Wakeely|واكيلي|wakeely" "$DST"/documents/*.tsx "$DST"/billing/*.tsx "$DST"/calendar/*.tsx "$DST"/court-rules/*.tsx "$DST"/print/*.tsx 2>&1 | head -5 || echo "  (clean)"
