#!/bin/bash
# Port LandingPage + AuthModal from reference Vite app to Next.js App Router.
# Faithful copy with import path rewrites only.

set -e

SRC=/home/z/my-project/reference-ui/extracted/wakeely-ui-reference/components
DST=/home/z/my-project/src/components

# --- LandingPage ---
sed \
  -e "s|from '../lib/LanguageContext'|from '@/components/providers/language-provider'|g" \
  -e "s|from '../lib/AuthContext'|from '@/components/providers/auth-provider'|g" \
  -e "s|from './AuthModal'|from '@/components/auth/auth-modal'|g" \
  -e "s|from './SubscriptionPaywallModal'|from '@/components/subscription/subscription-paywall-modal'|g" \
  "$SRC/LandingPage.tsx" > "$DST/landing/landing-page.tsx"

# Prepend 'use client' directive
{ echo "'use client';"; echo; cat "$DST/landing/landing-page.tsx"; } > "$DST/landing/landing-page.tsx.tmp" && mv "$DST/landing/landing-page.tsx.tmp" "$DST/landing/landing-page.tsx"

# --- AuthModal ---
sed \
  -e "s|from '../lib/AuthContext'|from '@/components/providers/auth-provider'|g" \
  -e "s|from '../lib/LanguageContext'|from '@/components/providers/language-provider'|g" \
  "$SRC/AuthModal.tsx" > "$DST/auth/auth-modal.tsx"

# Prepend 'use client' directive
{ echo "'use client';"; echo; cat "$DST/auth/auth-modal.tsx"; } > "$DST/auth/auth-modal.tsx.tmp" && mv "$DST/auth/auth-modal.tsx.tmp" "$DST/auth/auth-modal.tsx"

echo "LandingPage: $(wc -l < $DST/landing/landing-page.tsx) lines"
echo "AuthModal:    $(wc -l < $DST/auth/auth-modal.tsx) lines"
