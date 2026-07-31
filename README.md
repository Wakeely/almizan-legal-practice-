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
| Offline | IndexedDB cache + pending-mutations queue + Service Worker PWA shell |
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
  i18n.ts                        Full AR/EN dictionary (offline keys included)
  types.ts                       Shared TypeScript types
  gemini.ts                      Server-side Gemini client
  offline-storage.ts             IndexedDB cache (matters/tasks/documents/time_entries/
                                 invoices/calendar_events) + PENDING_MUTATIONS queue +
                                 enqueue/getPending/remove/markFailed/clear/count helpers
  offline-fetch.ts               offlineFetch() wrapper — queues mutations when offline,
                                 replays them on reconnect. replayMutation() + isQueuedOfflineResponse()
  make-matter-available-offline.ts  Explicit "cache this matter for offline use" helper +
                                 document binary cache via Cache API

src/hooks/
  use-offline-sync.ts            Online/offline + pending-mutations + last-synced state.
                                 Flushes queue on reconnect / visibilitychange.

src/components/offline/
  offline-banner.tsx             Top banner: offline / syncing / reconnected / failed
  sync-status-indicator.tsx      Footer badge: pending count + last synced + Sync now
  service-worker-register.tsx    Registers /sw.js

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
| Offline (IndexedDB + PWA) | **Full offline courtroom workspace.** IndexedDB read cache for matters/tasks/documents/time_entries/invoices/calendar_events + a `pending_mutations` queue that replays writes on reconnect. Service Worker caches the app shell so the app itself loads offline. Conflict resolution is last-write-wins (no OT/CRDT). Document binaries are cached on first download (Cache API) — opening a never-downloaded document offline is not possible. AI features require network and are not queued. |
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
| 6 | **Offline courtroom workspace** — pending-mutations queue + offline-aware fetch wrapper + reconnect sync (last-write-wins), Service Worker PWA shell, "Make available offline" button, sync status indicator, document binary caching via Cache API | ✅ Complete |

---

## Offline courtroom workspace

The app is a true PWA: the shell itself loads offline (Service Worker), and the
data layer is write-capable while disconnected (not just read-only).

### Architecture

| Layer | Responsibility | Where |
|---|---|---|
| **Read cache** | Each module writes its fetch results to IndexedDB on success and reads from cache when offline / network fails. | `STORES.MATTERS / TASKS / DOCUMENTS / TIME_ENTRIES / INVOICES / CALENDAR_EVENTS` in `src/lib/offline-storage.ts` |
| **Write queue** | Mutating requests (POST/PUT/PATCH/DELETE) performed while offline are appended to a queue instead of failing. | `STORES.PENDING_MUTATIONS` + `enqueueMutation` / `getPendingMutations` / `removeMutation` / `markMutationFailed` in `src/lib/offline-storage.ts` |
| **Offline-aware fetch** | `offlineFetch()` is a drop-in replacement for `fetch()` that detects offline / network errors and enqueues mutations. Returns a synthetic 202 response so optimistic UI stays responsive. | `src/lib/offline-fetch.ts` |
| **Sync hook** | Listens to `online` / `visibilitychange`, replays the queue in order on reconnect, dispatches `almizan:sync-complete` so modules can refresh. | `src/hooks/use-offline-sync.ts` |
| **PWA shell** | Service Worker precaches the app shell (HTML / JS / CSS / fonts / logo / manifest) so a full refresh while offline still loads. Network-first for `/api/*`, stale-while-revalidate for everything else. | `public/sw.js` + `src/components/offline/service-worker-register.tsx` |
| **Explicit cache** | "Make this matter available offline" button pre-fetches and caches all of a matter's tasks, documents, time entries, invoices, and calendar events. | `src/lib/make-matter-available-offline.ts` + button in `MattersModule` |

### Conflict resolution

Simple **last-write-wins** using the mutation `timestamp` field. No OT/CRDT.
When two queued mutations target the same resource, both are replayed in
enqueue order; the server applies them sequentially so the later one wins.
Permanent 4xx failures are marked `failed` and surfaced via the
`SyncStatusIndicator`; transient 5xx failures stop the flush and retry on the
next `online` event.

### Multi-tenant safety

The IndexedDB cache is per-browser, per-origin, and only ever holds data the
authenticated user fetched through the org-scoped API. The Service Worker only
caches same-origin responses; cross-origin requests pass through. No
organisation can read another organisation's data through the cache.

### How to test offline (checklist)

Run the dev server (`bun run dev`) and sign in. Then in Chrome DevTools:

1. **Read while offline** — Open DevTools → Application → Service Workers →
   tick "Offline". Refresh the page. The workspace should still load from the
   IndexedDB cache (banner shows "Offline Mode Active").
2. **Write while offline** — Drag a Kanban card to a new stage. The card
   should move optimistically; the footer badge should show
   "1 pending changes". Open DevTools → Application → IndexedDB →
   `almizan-offline-cache` → `pending_mutations` to see the queued write.
3. **Reconnect sync** — Untick "Offline". The banner should briefly show
   "Synchronizing legal records…" then "Reconnected to Internet". The footer
   badge should reset to "0 pending changes • Last synced HH:MM". Refresh the
   page — the moved task should still be in its new stage (now persisted
   server-side).
4. **Full refresh offline** — With "Offline" ticked, hard-refresh the page
   (Ctrl+Shift+R). The Service Worker should serve the cached shell, then
   React hydrates and reads data from IndexedDB. The workspace should be
   fully usable.
5. **Make available offline** — Untick "Offline". On a matter, click the
   "Make this matter available offline" button. Wait for the green "Cached
   for offline use" state. Tick "Offline" again, refresh — all the matter's
   tasks / documents / time entries / invoices / calendar events should be
   visible.
6. **Document binary cache** — While online, click the download button on a
   document. Then go offline and click download again — the file should still
   download from the Cache API cache.
7. **AI gating** — While offline, try the AI Copilot or "Run Risk Analysis".
   The request should fail gracefully (no silent success).

### Files added / modified

| File | Reason |
|---|---|
| `src/lib/offline-storage.ts` | Added `CALENDAR_EVENTS` + `PENDING_MUTATIONS` stores, queue helpers (`enqueueMutation`, `getPendingMutations`, `removeMutation`, `markMutationFailed`, `clearPendingMutations`, `countPendingMutations`, `deleteFromOfflineStore`). Bumped `DB_VERSION` to 2. |
| `src/lib/offline-fetch.ts` | NEW. `offlineFetch()` wrapper, `replayMutation()`, `isQueuedOfflineResponse()`. |
| `src/lib/make-matter-available-offline.ts` | NEW. Explicit-cache helper + document binary cache (`cacheDocumentBlob` / `getCachedDocumentBlob` / `isDocumentBinaryCached`). |
| `src/hooks/use-offline-sync.ts` | NEW. `useOfflineSync()` hook with online/offline listeners + queue flush on reconnect + visibilitychange. |
| `src/components/offline/offline-banner.tsx` | NEW. Persistent top banner. |
| `src/components/offline/sync-status-indicator.tsx` | NEW. Footer badge with pending count + last-synced + Sync now. |
| `src/components/offline/service-worker-register.tsx` | NEW. Registers `/sw.js`. |
| `public/sw.js` | NEW. Service Worker — precache app shell, network-first for API, SWR for assets. |
| `public/offline.html` | NEW. Offline fallback page (auto-reloads on reconnect). |
| `src/lib/i18n.ts` | Added 10 new AR+EN keys for the offline UX (pending / last-synced / sync-now / make-available / etc.). |
| `src/app/page.tsx` | `fetchMatters()` now writes back to `STORES.MATTERS` on success and falls back to `getAllFromOfflineStore(STORES.MATTERS)` offline. Mounted `OfflineBanner` + `ServiceWorkerRegister` + `SyncStatusIndicator`. Added `almizan:sync-complete` listener. |
| `src/components/calendar/calendar-module.tsx` | `fetchEvents()` now writes back to `STORES.CALENDAR_EVENTS` on success and falls back to cache offline. |
| `src/components/tasks/tasks-module.tsx` | All mutations (`handleCreateTask`, `updateTaskStatus`, `updateTaskPriority`, `toggleTaskClientVisibility`) now use `offlineFetch`. Optimistic UI updates persist to `STORES.TASKS` so they survive refresh. |
| `src/components/documents/documents-module.tsx` | `toggleClientVisibility` uses `offlineFetch`. `handleDownload` now caches the binary via `cacheDocumentBlob` and serves the cached blob when offline. |
| `src/components/billing/billing-module.tsx` | `handleStopTimer`, `handleCreateTimeEntry`, `handleGenerateInvoice`, `handleMarkInvoicePaid` all use `offlineFetch` with optimistic UI + cache persistence. |
| `src/components/matters/matters-module.tsx` | Added "Make this matter available offline" button with progress / done / failed states. |

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
