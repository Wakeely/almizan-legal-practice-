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
| Legal RAG (Jordan) | **Grounded Q&A with mandatory citations** over a curated Jordanian legal corpus (31 articles across 7 statutes) + org-scoped matter files. pgvector semantic search in production; SQLite dev degrades to text search. See [Legal RAG (Jordan)](#legal-rag-jordan) below. Corpus is **not** a complete codification — see honesty notes. |

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

## Legal RAG (Jordan)

Al Mizan ships a **grounded legal Q&A system** — not just document management +
a chatbot. Lawyers can ask questions about an active matter and get answers
backed by **real citations** (law name + article number + excerpt, and/or
document name + page / transcript page). If retrieval finds nothing, the system
says so explicitly instead of inventing articles.

### Architecture

```
src/lib/rag/
  types.ts     — shared RAG types (Citation, RagAnswer, etc.)
  embed.ts     — Gemini text-embedding-004 (768-dim), server-side only
  chunk.ts     — text chunking (~500 tokens, 15% overlap, page-aware for transcripts)
  ingest.ts    — chunk + embed + upsert DocumentChunk rows
  retrieve.ts  — pgvector similarity search (matter + corpus) with text fallback
  answer.ts    — retrieve → strict prompt → Gemini → post-process citations

src/app/api/ai/rag/route.ts        — POST grounded Q&A
src/app/api/ai/rag/ingest/route.ts — POST re-ingest document/transcript/matter

src/components/ai/rag-panel.tsx    — "Ask with Sources" UI tab
data/jordanian-corpus.ts           — curated Jordanian legal corpus (31 articles)
scripts/rag/seed-jordan-corpus.ts  — embed + upsert corpus into LegalCorpus
scripts/rag/test-rag-jordan.ts     — Arabic query smoke test
prisma/sql/rag_pgvector_setup.sql  — pgvector extension + HNSW indexes + match functions
```

### Multi-tenant isolation (mandatory)

- **DocumentChunk** rows carry `organizationId` + `matterId`.
- `match_document_chunks()` SQL function **requires** `filter_org` and
  `filter_matter` parameters — there is no overload that returns cross-org
  chunks. This is enforced at the database level, not just in application code.
- **LegalCorpus** is global read-only (the law is the law) — shared across
  orgs but never written from the application.
- The `/api/ai/rag` route calls `verifyMatterBelongsToOrg()` **before** any
  retrieval runs.

### Setup (production — Postgres + pgvector)

```bash
# 1. After `prisma db push` has created DocumentChunk + LegalCorpus tables:
psql "$DATABASE_URL" -f prisma/sql/rag_pgvector_setup.sql
#    (enables pgvector, adds embedding columns, creates HNSW indexes + match fns)

# 2. Seed the Jordanian corpus (embeds each article via Gemini):
GEMINI_API_KEY=... bun run rag:seed

# 3. Smoke-test retrieval with Arabic queries:
GEMINI_API_KEY=... bun run rag:test
```

### Setup (local dev — SQLite, no pgvector)

```bash
# SQLite dev schema OMITS the embedding column. The seed script still inserts
# article rows (text-only) and retrieve.ts falls back to Prisma `contains`
# text search. Semantic search is unavailable but keyword search works.
bun run db:push:dev
DATABASE_URL="file:$(pwd)/prisma/dev.db" bun run rag:seed
DATABASE_URL="file:$(pwd)/prisma/dev.db" bun run rag:test
```

### What the corpus covers (and what it does NOT)

The curated corpus includes **31 articles** across 7 Jordanian statutes most
commonly cited in litigation:

| Statute | Law type | Articles |
|---|---|---|
| القانون المدني الأردني (Civil Code, 1976) | `civil` | 146, 166, 183, 256, 257, 265, 336, 347 |
| قانون العمل (Labour Law, 1996) | `labour` | 23, 67, 74, 61, 82 |
| قانون أصول المحاكمات المدنية (Civil Procedure, 1988) | `procedure` | 5, 43, 60, 76, 152 |
| قانون البينات (Evidence Law, 1952) | `evidence` | 2, 13, 39, 44 |
| قانون المالكين والمستأجرين (Rent Law, 1994) | `rent` | 5, 13, 17 |
| قانون السير (Traffic Law, 2008) | `traffic` | 31, 46, 70 |
| قانون الأحوال الشخصية (Personal Status, 2010) | `maintenance` | 66, 68, 175 |

**This is NOT a complete codification of Jordanian law.** It is a curated
starting set focused on the highest-frequency litigation areas. The articles
are paraphrased faithfully from the official Arabic text; the lawyer remains
responsible for verifying against the official gazette before relying on a
citation. To extend the corpus, add entries to `data/jordanian-corpus.ts`
and re-run `bun run rag:seed` (upserts by `lawName + articleNumber`).

### How lawyers should use this

The **"Ask with Sources"** tab in the AI module is the grounded Q&A entry
point. It is the default tab — lawyers land on grounded retrieval first, not
on free-form generation.

1. **Ask a question** about the active matter, e.g.
   "ما هي مدة تقادم الالتزامات المدنية؟" or
   "What did the witness say about the contract signing date?"
2. **Toggle scope** — search matter files only, Jordanian law only, or both
   (default).
3. **Read the answer** with inline citations `[source N]` and a badge showing
   `Grounded — N sources` or `No sources found`.
4. **Expand source chips** to read the exact excerpt. Statute citations show
   law name + article number + Arabic text. Document/transcript citations
   show file name + page number + excerpt.
5. **Trust the refusal path** — if the badge says "No sources found", the
   system genuinely found nothing relevant. It will NOT invent article numbers.

**This is not a substitute for a legal opinion.** The disclaimer
("AI-assisted. Non-authoritative — lawyer remains responsible.") is attached
to every response. Use RAG to find relevant material faster; verify every
citation against the primary source before filing.

### Re-ingesting

Documents and transcripts are ingested automatically on upload/create. To
re-ingest manually (e.g. after setting up pgvector for the first time, or
after changing chunking strategy):

```bash
# Re-ingest a single document:
curl -X POST http://localhost:3000/api/ai/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{"type":"document","documentId":"<id>"}'

# Re-ingest a whole matter (all documents + transcripts):
curl -X POST http://localhost:3000/api/ai/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{"type":"matter","matterId":"<id>"}'
```

When a document is deleted, its chunks are removed automatically (org-scoped
delete) so they don't surface in future Q&A.

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
