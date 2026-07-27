# Al Mizan Legal Practice — Litigation & Legal Practice System

> **الميزان للممارسة القانونية**

Bilingual (Arabic/English, RTL-capable) legal practice & litigation management
platform for GCC/MENA jurisdictions (Jordan, UAE/DIFC/ADGM, Saudi, Kuwait).

A faithful port of a reference Vite/React UI, rebuilt on a secure multi-tenant
Next.js 16 stack with server-side AI (Gemini) and strict organization isolation.

**Live deployment**: https://almizan.legalwakeely.com

---

## Architecture & Security

### Multi-tenancy (mandatory)
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
- `Managing Partner` (full firm access — only role that can view audit log)
- `Senior Associate`
- `In-House Counsel`
- `Legal Executive`
- `Client Representative` (client-portal-only)

### AI (Gemini)
- All Gemini calls are server-side only via `src/lib/gemini.ts`.
- The `GEMINI_API_KEY` is read from environment variables and never sent to the browser.
- Client-facing AI assistants in ClientPortal are restricted to records marked `visibleToClient: true`.
- Every AI response includes `_disclaimer: "AI-assisted. Non-authoritative."` and `_stub: true` when key is empty.

### Audit log (append-only)
- `AuditLog` is an append-only Prisma model (`src/lib/audit.ts` is the single writer).
- No update/delete endpoint for audit entries.
- Reads restricted to `Managing Partner` role within the same organization (via `/api/audit-log`).
- Captures: `auth.register`, `auth.login`, `auth.logout`, `auth.subscription.updated`, `matter.create/update`, `task.create/update/delete`, `document.create/update/delete`, `time-entry.*`, `invoice.*`, `calendar-event.*`, `privilege-log.*`, `transcript.*`, `war-room.*`, `conflict-check.*`, `ai.*` (8 AI actions), `audit-log.view`.

### Rate limiting
- In-memory token-bucket on `/api/auth/*` (10 bursts, 1 token / 5 s) and `/api/ai/*` (20 bursts, 1 token / 2 s) per IP+org.

### Client portal data filtering (server-side)
- `GET /api/client-portal/matters/[id]/documents` returns ONLY documents where `visibleToClient: true`.
- `GET /api/client-portal/matters/[id]/timeline` returns ONLY events where `visibleToClient: true`.
- Filtering happens server-side — never relies on the frontend to hide privileged information.

---

## Tech stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| ORM | Prisma 6 + PostgreSQL (production) / SQLite (local dev) |
| Auth | NextAuth.js v4 (Credentials + JWT cookies) |
| Validation | Zod 4 |
| i18n | Custom dictionary (`src/lib/i18n.ts`) with RTL via `dir` attribute |
| AI | `z-ai-web-dev-sdk` (server-side only) — Gemini |
| Charts | Recharts |
| Drag-and-drop | `@dnd-kit/core` (Kanban board) |
| Offline | IndexedDB via `src/lib/offline-storage.ts` (real implementation) |
| Fonts | Tajawal (Arabic-first) + JetBrains Mono |

---

## Project layout

```
prisma/
  schema.prisma                  Production schema (PostgreSQL)
  schema.dev.prisma              Local dev schema (SQLite)
  migrations/0000_init/          Initial migration SQL + chunked fallback

src/lib/
  auth-options.ts                NextAuth config
  session.ts                     getSessionUser() / getFullUserProfile()
  org.ts                         requireUser(), requireRole(), orgWhere(), verifyMatterBelongsToOrg()
  password.ts                    bcrypt hash/verify + strength check
  rate-limit.ts                  In-memory token bucket
  audit.ts                       Append-only audit log writer
  validation/auth.ts             Zod schemas
  i18n.ts                        Full AR/EN dictionary (730 lines)
  types.ts                       Shared TypeScript types
  gemini.ts                      Server-side Gemini client
  offline-storage.ts             Real IndexedDB offline cache

src/app/
  layout.tsx                     Tajawal + JetBrains Mono fonts; Theme → Language → Auth providers
  page.tsx                       State-driven SPA: landing → auth → workspace
  globals.css                    Executive Legal Teal palette, RTL fix, print styles,
                                 form input text color fix (slate-900 always)
  api/
    auth/*                       register, login, logout, me, reset-password, subscription, [...nextauth]
    matters/*                    CRUD + nested routes for documents, tasks, billing, calendar, transcripts, etc.
    documents/*                  CRUD
    tasks/*                       CRUD with dependency lock enforcement
    time-entries/*                CRUD
    invoices/*                    CRUD
    calendar/*                    events, bulk-deadlines, sync-google (stub)
    messages/*                    CRUD
    privilege-log/*               CRUD
    transcripts/*                 CRUD with nested TranscriptPage
    conflict-check/*              CRUD
    client-portal/matters/[id]/*  SERVER-FILTERED documents + timeline
    search                        Global search across matters/documents/tasks
    all-searchable-data           Bulk aggregator for GlobalSearchModal
    audit-log                     Managing Partner-only viewer
    ai/*                          8 server-side Gemini routes (draft, generate-pleading,
                                  summarize, ledes-classify, calculate-court-deadlines,
                                  analyze-risk, privilege-analysis, transcript-search)

src/components/
  providers/                      theme-provider, language-provider, auth-provider
  landing/landing-page.tsx       Faithful port (915 lines)
  auth/auth-modal.tsx            Faithful port (575 lines)
  header/header.tsx              Profile widget, matter selector, mode toggle
  matters/, analytics/, tasks/   Matters + Analytics + Kanban Tasks
  documents/, billing/           Documents (with redaction) + Billing (with LEDES)
  calendar/, court-rules/        Calendar + Court Rules Calculator
  ai/, war-room/                 AI Copilot + War Room
  client-portal/                 Server-filtered Client Portal
  privilege/, deposition/        Privilege Log + Deposition Indexer
  conflict/, search/, subscription/  Conflict Check + Global Search + Paywall
  mobile/mobile-bottom-nav.tsx   Bottom tab navigation
  print/print-preview-modal.tsx  A4 courtroom docket
```

---

## Current Limitations (honesty section)

Per the master system prompt rule #7 (Honesty About Features):

| Area | Status |
|---|---|
| Database | **PostgreSQL in production** (Vercel Postgres). SQLite for local dev only. |
| Rate limiting | In-memory token bucket per process. **Not shared across instances.** Use Redis for multi-instance. |
| Password reset | `POST /api/auth/reset-password` accepts email + audit-logs but does NOT send email. Code-entry step is client-side simulated. |
| Biometric auth (WebAuthn) | UI flag only. Real WebAuthn not implemented. |
| Subscription billing | Tier + billing cycle persisted. **No real payment gateway** — upgrade flow simulates payment. |
| Document redaction | Visual-only overlay. **Permanent file redaction** (rewriting PDFs) not implemented. |
| Bates stamping | Sequential numbering display only. No permanent PDF Bates stamping. |
| LEDES 1998B | Basic pipe-delimited export. Full LEDES validation is a separate undertaking. |
| Offline (IndexedDB) | **Real IndexedDB cache implemented** for matters/documents/tasks/time entries/invoices. Read-only offline — mutations queue but require reconnect to sync. |
| Google Calendar sync | Calendar UI complete. **Actual Google Calendar API sync not wired** (requires OAuth + sync worker). |
| Conflict of Interest | Entity search runs locally (no cross-firm database lookup). Ethical clearance certificate is generated locally, not from a central registry. |
| Audit log viewer | Implemented (`/api/audit-log`) but no UI panel yet — accessible via API only. |

---

## Getting started (local dev)

```bash
# 1. Install deps
bun install

# 2. Push Prisma schema to local SQLite (uses schema.dev.prisma)
bun run db:push:dev

# 3. Run the dev server
bun run dev
```

### Environment variables (`.env`)
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GEMINI_API_KEY=                     # server-side only; leave empty to stub AI
PRISMA_DATABASE_URL=                # only needed for production Postgres
```

---

## Production deployment (Vercel)

1. **Create Vercel Postgres** (Storage → Create Database → Postgres free tier).
   Vercel auto-injects `DATABASE_URL` (pooled) + `PRISMA_DATABASE_URL` (direct).
2. **Set env vars** in Vercel → Settings → Environment Variables:
   - `NEXTAUTH_URL` = `https://almizan.legalwakeely.com`
   - `NEXTAUTH_SECRET` = `openssl rand -base64 32`
   - `GEMINI_API_KEY` = your Gemini API key from Google AI Studio
3. **Push to GitHub** — Vercel auto-deploys.
4. **Tables are created automatically** on first build (via `prisma generate` in build script). If you need to manually create them, see `prisma/migrations/0000_init/migration.sql`.

---

## Rollout (5 turns)

| Turn | Scope | Status |
|---|---|---|
| 1 | Foundation — design system, i18n, multi-tenant schema, auth, org isolation, audit log, rate limit, LandingPage + AuthModal | ✅ Complete |
| 2 | Lawyer workspace shell — Header, MattersModule, AnalyticsModule, TasksModule (Kanban), MobileBottomNav | ✅ Complete |
| 3 | DocumentsModule, DocumentRedactionModal, BillingModule, CalendarModule, CourtRulesCalendaringModule, PrintPreviewModal + Gemini AI routes | ✅ Complete |
| 4 | AiModule (drafting copilot), WarRoomModule, ClientPortal (server-filtered), PrivilegeLogModule, DepositionIndexerModule + 16 API routes | ✅ Complete |
| 5 | ConflictCheckModal, GlobalSearchModal, SubscriptionPaywallModal (real), real IndexedDB offline cache, audit log viewer API, hardening pass | ✅ Complete |

---

## Brand

**Al Mizan Legal Practice** (الميزان للممارسة القانونية) — "Al Mizan" means
"The Scale" in Arabic, evoking the scales of justice that sit at the heart of
every legal practice.

---

## License & attribution

Tajawal and JetBrains Mono fonts via Google Fonts. shadcn/ui component library.
Rebuilt with a secure multi-tenant Next.js 16 stack. Reference UI design
faithfully ported; backend rebuilt with proper auth, org isolation, and audit
logging per the master system prompt rules.
