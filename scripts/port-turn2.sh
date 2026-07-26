#!/bin/bash
# Port Turn 2 components from reference Vite app to Next.js App Router.
# Faithful copies with import path rewrites only.

set -e

SRC=/home/z/my-project/reference-ui/extracted/wakeely-ui-reference/components
DST=/home/z/my-project/src/components

mkdir -p "$DST/matters" "$DST/analytics" "$DST/tasks" "$DST/header" "$DST/mobile"

# Common sed substitution: rewrite reference import paths to Next.js paths
REWRITE=(
  -e "s|from '../lib/LanguageContext'|from '@/components/providers/language-provider'|g"
  -e "s|from '../lib/AuthContext'|from '@/components/providers/auth-provider'|g"
  -e "s|from '../types'|from '@/lib/types'|g"
  -e "s|from '../lib/i18n'|from '@/lib/i18n'|g"
  -e "s|from './PrintPreviewModal'|from '@/components/print/print-preview-modal'|g"
  -e "s|from './TaskDependencyModal'|from '@/components/tasks/task-dependency-modal'|g"
)

port_file() {
  local src_file="$1"
  local dst_file="$2"
  sed "${REWRITE[@]}" "$src_file" > "$dst_file"
  # Prepend 'use client' directive
  { echo "'use client';"; echo; cat "$dst_file"; } > "$dst_file.tmp" && mv "$dst_file.tmp" "$dst_file"
  echo "  ported: $(basename $src_file) → $dst_file ($(wc -l < $dst_file) lines)"
}

echo "Porting Turn 2 components..."
port_file "$SRC/MattersModule.tsx"        "$DST/matters/matters-module.tsx"
port_file "$SRC/AnalyticsModule.tsx"       "$DST/analytics/analytics-module.tsx"
port_file "$SRC/TaskDependencyModal.tsx"   "$DST/tasks/task-dependency-modal.tsx"
port_file "$SRC/TasksModule.tsx"          "$DST/tasks/tasks-module.tsx"
port_file "$SRC/Header.tsx"               "$DST/header/header.tsx"
port_file "$SRC/MobileBottomNav.tsx"      "$DST/mobile/mobile-bottom-nav.tsx"
