# Al Mizan Legal Practice — Litigation & Legal Practice System

> **الميزان للممارسة القانونية**

Bilingual (Arabic/English, RTL-capable) legal practice & litigation management
platform for GCC/MENA jurisdictions (Jordan, UAE/DIFC/ADGM, Saudi, Kuwait).

This is a faithful port of a reference Vite/React UI, rebuilt on a secure
multi-tenant Next.js 16 stack with server-side AI (Gemini) and strict
organization isolation.

---

## Architecture & Security

### Multi-tenancy
- Every tenant-owned Prisma model carries `organizationId` + a relation to `Organization`.
- All API queries are scoped via `requireUser()` + `orgWhere(session, …)` (see `src/lib/org.ts`).
- There is no global shared data across firms.

### Authentication
- NextAuth v4 with Credentials provider + JWT session strategy.
- Cookies: `HttpOnly + SameSite=Lax + Secure` (Secure in production).
- Passwords hashed with `bcryptjs` (12 rounds).
- Session lifetime: 30 minutes (sliding).
- Every sensitive route calls `requireUser()` or `requireRole([...])`.

### Authorization — Roles
- `Managing Partner` (full firm access)
- `Senior Associate`
- `In-House Counsel`
- `Legal Executive`
- `Client Representative` (client-portal-only)

### AI (Gemini)
- All Gemini calls are server-side only.
- The `GEMINI_API_KEY` is read from environment variables and never sent to the browser.
- Client-facing AI assistants (Turn 4+) will be restricted to records marked `visibleToClient: true`.

### Audit log
- `AuditLog` is an append-only Prisma model (`src/lib/audit.ts` is the single writer).
- There is no update/delete endpoint for audit entries.
- Reads are restricted to `Managing Partner` role within the same organization.
- Captures `auth.register`, `auth.login`, `auth.logout` via NextAuth `events.signIn` / `events.signOut` callbacks.

### Rate limiting
- In-memory token-bucket on `/api/auth/*` (10 bursts, 1 token / 5 s) and `/api/ai/*` (20 bursts, 1 token / 2 s).

---

## Tech stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| ORM | Prisma 6 + SQLite (dev) / PostgreSQL (prod) |
| Auth | NextAuth.js v4 (Credentials + JWT cookies) |
| Validation | Zod 4 |
| i18n | Custom dictionary (`src/lib/i18n.ts`) with RTL via `dir` attribute |
| AI | `z-ai-web-dev-sdk` (server-side only) — Gemini |
| Charts | Recharts |
| Drag-and-drop | `@dnd-kit/core` (for Kanban board in Turn 2) |

---

## Project layout

```
prisma/
  schema.prisma             Multi-tenant schema (15+ models, organizationId everywhere)

src/lib/
  auth-options.ts           NextAuth config (Credentials + JWT + HttpOnly cookies)
  session.ts                getSessionUser() / getFullUserProfile() server helpers
  org.ts                    requireUser(), requireRole(), orgWhere(), verifyMatterBelongsToOrg()
  password.ts              bcrypt hash/verify + password strength check
  rate-limit.ts            In-memory token bucket
  audit.ts                  Append-only audit log writer
  validation/auth.ts       Zod schemas (register, login, subscription, matter)
  i18n.ts                   Full AR/EN dictionary (730 lines)
  types.ts                  Shared TypeScript types

src/app/
  layout.tsx                Tajawal + JetBrains Mono fonts; ThemeProvider → LanguageProvider → AuthProvider
  page.tsx                  State-driven SPA: landing → auth → workspace placeholder
  globals.css               Executive Legal Teal palette, RTL letter-spacing fix, print styles
  api/auth/
    [...nextauth]/route.ts  NextAuth handler (login/session/CSRF)
    register/route.ts       POST — creates Organization + Managing Partner user
    login/route.ts          POST — validates credentials (for ref UI compat)
    logout/route.ts         POST — audit only; client uses signOut()
    me/route.ts             GET — full user profile
    reset-password/route.ts POST — MVP (returns 200 always, audit logged)
    subscription/route.ts   POST — updates tier + billing cycle

src/components/
  providers/
    theme-provider.tsx      next-themes wrapper
    language-provider.tsx   AR/EN with dir attribute + localStorage
    auth-provider.tsx        useAuth() — wraps NextAuth signIn/signOut
  landing/landing-page.tsx  Faithful port (915 lines)
  auth/auth-modal.tsx       Faithful port (575 lines)
  subscription/
    subscription-paywall-modal.tsx  STUB (porting in Turn 5)
```

---

## Current Limitations (honesty section)

Per the master system prompt rule #7 (Honesty About Features), the following
are explicitly NOT yet production-ready:

| Area | Status |
|---|---|
| Database | **SQLite dev only.** Schema is Postgres-portable (one-line `provider` change + `DATABASE_URL` swap). Run PostgreSQL in production. |
| Rate limiting | In-memory token bucket per process. **Not shared across instances.** Use Redis (`@upstash/ratelimit` or equivalent) for multi-instance deploys. |
| Password reset | `POST /api/auth/reset-password` accepts an email and audit-logs the request, but does NOT actually send a reset code via email. The "enter code" step in `AuthModal` is a client-side simulation. Real email delivery (SendGrid / SES / SMTP) is a TODO. |
| Biometric auth (WebAuthn) | Stored as a UI flag on the user record (`biometricEnabled`). Real WebAuthn is not implemented. |
| Subscription billing | Subscription tier + billing cycle are persisted, but there is no real payment gateway integration. The paywall modal is a stub. |
| Lawyer workspace modules | Header, MattersModule, AnalyticsModule, TasksModule, DocumentsModule, BillingModule, CalendarModule, AiModule, WarRoomModule, ClientPortal, PrivilegeLogModule, DepositionIndexerModule, etc. — **ship in Turns 2–5 of the rollout plan.** The Turn 1 build only delivers the foundation + landing page + auth flow. |
| Document redaction | Visual-only overlay (Turn 3). Permanent file redaction (rewriting PDFs to black out regions) is a separate undertaking. |
| Bates stamping | Sequential numbering display only (Turn 3). No permanent PDF Bates stamping. |
| LEDES 1998B | Basic pipe-delimited export (Turn 3). Full LEDES validation is a separate undertaking. |
| Offline (IndexedDB) | Not yet implemented. The reference UI uses IndexedDB caching; this will be ported in Turn 5. |
| Google Calendar sync | Calendar UI ships in Turn 3, but actual Google Calendar API sync is not wired (would require OAuth credentials and a sync worker). |

---

## Getting started

```bash
# 1. Install deps
bun install

# 2. Push Prisma schema to SQLite
bun run db:push

# 3. Run the dev server
bun run dev
```

### Environment variables
Required in `.env` (NEVER commit this file — already in `.gitignore`):
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GEMINI_API_KEY=                     # server-side only; leave empty to stub AI
```

---

## Rollout plan (5 turns)

| Turn | Scope | Status |
|---|---|---|
| 1 | Foundation — design system, i18n, multi-tenant schema, auth, org isolation, audit log, rate limit, LandingPage + AuthModal | ✅ Complete |
| 2 | Lawyer workspace shell — Header, MattersModule, AnalyticsModule, TasksModule, MobileBottomNav | 🚧 In progress |
| 3 | DocumentsModule, DocumentRedactionModal, BillingModule, CalendarModule, CourtRulesCalendaringModule, PrintPreviewModal | ⏳ Pending |
| 4 | AiModule (Gemini drafting copilot), WarRoomModule, ClientPortal (server-filtered), PrivilegeLogModule, DepositionIndexerModule | ⏳ Pending |
| 5 | ConflictCheckModal, GlobalSearchModal, SubscriptionPaywallModal (real), offline IndexedDB cache, audit log viewer, hardening pass | ⏳ Pending |

---

## Brand

**Al Mizan Legal Practice** (الميزان للممارسة القانونية) — "Al Mizan" means
"The Scale" in Arabic, evoking the scales of justice that sit at the heart of
every legal practice.

---

## License & attribution

Tajawal and JetBrains Mono fonts via Google Fonts. shadcn/ui component
library. Rebuilt with a secure multi-tenant Next.js 16 stack.
