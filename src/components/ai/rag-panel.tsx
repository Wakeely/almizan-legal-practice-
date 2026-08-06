'use client';

// =============================================================================
// Al Mizan — RAG panel (grounded legal Q&A with citations)
// -----------------------------------------------------------------------------
// This is the lawyer-facing UI for /api/ai/rag. It posts a question + matterId
// and renders the answer with source chips. Each chip expands to show the
// excerpt and (where available) a deep-link to the source document or
// transcript page.
//
// Design principles (from the product spec):
//   - Grounded or refuse: badge shows "Grounded — N sources" or "No sources
//     found". Never silently returns an ungrounded answer.
//   - Citations are mandatory: every source chip shows type + name + article
//     number / page number + excerpt.
//   - Disclaimer is always visible.
//   - Arabic + English: all strings from i18n, RTL-aware.
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Send,
  Search,
  FileText,
  Scale,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Database,
  DatabaseZap,
  Lock,
} from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';

// Mirror of src/lib/rag/types.ts Citation / RagAnswer shapes.
// Duplicated here to avoid pulling server-only types into the client bundle.
interface Citation {
  type: 'statute' | 'document' | 'transcript';
  lawName?: string;
  lawType?: string;
  articleNumber?: string;
  title?: string;
  year?: number;
  sourceUrl?: string;
  documentId?: string;
  documentName?: string;
  transcriptId?: string;
  pageNumber?: number;
  chunkIndex?: number;
  excerpt: string;
  chunkId?: string;
  confidence?: number;
}

interface RagAnswer {
  answer: string;
  sources: Citation[];
  grounded: boolean;
  noSources: boolean;
  matterHits: number;
  corpusHits: number;
  disclaimer: string;
  lang: 'ar' | 'en';
  _stub: boolean;
  _textFallback: boolean;
}

interface RagPanelProps {
  activeMatter: Matter;
}

export default function RagPanel({ activeMatter }: RagPanelProps) {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  // Accept both forms — see seed/route.ts for the inconsistency explanation.
  // The Role type only lists the spaced form, but the DB may hold either.
  const role = user?.role as string | undefined;
  const isManagingPartner =
    role === 'MANAGING_PARTNER' || role === 'Managing Partner';

  const [question, setQuestion] = useState('');
  const [includeMatter, setIncludeMatter] = useState(true);
  const [includeCorpus, setIncludeCorpus] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  // --- One-click setup state (Managing Partner only) ---
  // The setup endpoint is gated by RAG_SEED_ENABLED=1 on the server. We probe
  // GET /api/ai/rag/setup on mount to learn the current RAG state and decide
  // whether to show the one-click setup button.
  const [setupStatus, setSetupStatus] = useState<{
    enabled: boolean;
    hasGeminiKey: boolean;
    tablesExist: boolean;
    pgvectorEnabled: boolean;
    embeddingColumnsExist: boolean;
    matchFunctionExists: boolean;
    corpusCount: number;
    withEmbeddings: number;
    fullySetup: boolean;
  } | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<any>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  // --- Migration state (Managing Partner only) ---
  // Detects whether the LegalCorpus table is missing the new amendment
  // columns (lawNameEn, status, etc.). If so, shows a prominent migration
  // banner — independent of RAG_SEED_ENABLED, so the admin always sees it.
  const [migrateStatus, setMigrateStatus] = useState<{
    enabled: boolean;
    migrationNeeded: boolean;
    diagnosis: string;
    articleCount: number;
  } | null>(null);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrateResult, setMigrateResult] = useState<any>(null);
  const [migrateError, setMigrateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManagingPartner) return;
    fetch('/api/mcp/migrate', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setMigrateStatus(data); })
      .catch(() => {});
  }, [isManagingPartner]);

  const handleMigrate = async () => {
    if (!confirm(
      isRtl
        ? 'سيتم تحديث قاعدة البيانات وإعادة تحميل المدوّنة. يستغرق ثوانٍ. هل تريد المتابعة؟'
        : 'This will update the database schema and re-seed the corpus (~10 seconds). Continue?'
    )) return;
    setMigrateLoading(true);
    setMigrateError(null);
    setMigrateResult(null);
    try {
      const res = await fetch('/api/mcp/migrate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.ragErrorGeneric);
      setMigrateResult(data);
      // Refresh both status probes.
      const migRes = await fetch('/api/mcp/migrate', { cache: 'no-store' });
      if (migRes.ok) setMigrateStatus(await migRes.json());
      const setupRes = await fetch('/api/ai/rag/setup', { cache: 'no-store' });
      if (setupRes.ok) setSetupStatus(await setupRes.json());
    } catch (err: any) {
      setMigrateError(err.message || t.ragErrorGeneric);
    } finally {
      setMigrateLoading(false);
    }
  };

  useEffect(() => {
    if (!isManagingPartner) return;
    fetch('/api/ai/rag/setup', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSetupStatus(data);
      })
      .catch(() => {
        // Endpoint not deployed yet — just hide the button.
      });
  }, [isManagingPartner]);

  const handleSetup = async () => {
    if (!confirm(
      isRtl
        ? 'سيتم إعداد نظام RAG بالكامل: إنشاء الجداول، تفعيل pgvector، إنشاء التضمينات لـ 31 مادة قانونية. قد يستغرق ذلك 1-2 دقيقة. هل تريد المتابعة؟'
        : 'This will set up the entire RAG system: create tables, enable pgvector, generate embeddings for 31 legal articles (~1-2 minutes). Continue?'
    )) return;
    setSetupLoading(true);
    setSetupError(null);
    setSetupResult(null);
    try {
      const res = await fetch('/api/ai/rag/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.ragErrorGeneric);
      setSetupResult(data);
      // Refresh the status probe.
      const statusRes = await fetch('/api/ai/rag/setup', { cache: 'no-store' });
      if (statusRes.ok) setSetupStatus(await statusRes.json());
    } catch (err: any) {
      setSetupError(err.message || t.ragErrorGeneric);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setExpandedSource(null);
    try {
      const res = await fetch('/api/ai/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: activeMatter.id,
          question: question.trim(),
          lang: isRtl ? 'ar' : 'en',
          includeMatter,
          includeCorpus,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: t.ragErrorGeneric }));
        throw new Error(errData.error || t.ragErrorGeneric);
      }
      const data: RagAnswer = await res.json();
      setAnswer(data);
    } catch (err: any) {
      setError(err.message || t.ragErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Subtitle — honesty about corpus limits */}
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-card border border-border rounded-xl p-2.5">
        <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <span>{t.ragSubtitle}</span>
      </div>

      {/* --- MIGRATION BANNER (Managing Partner only, shows when schema is out of sync) --- */}
      {/* This shows EVEN IF RAG_SEED_ENABLED=0, because a broken schema is
          critical and the admin needs to see it immediately. The POST endpoint
          still requires RAG_SEED_ENABLED=1, but the detection (GET) is always on. */}
      {isManagingPartner && migrateStatus?.migrationNeeded && (
        <div className="border border-rose-300 bg-rose-50 rounded-2xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <div className="flex-grow min-w-0">
              <div className="text-xs font-bold text-rose-900">
                {isRtl ? 'تحديث قاعدة البيانات مطلوب' : 'Database update required'}
              </div>
              <div className="text-[10px] text-rose-700 mt-1 leading-relaxed">
                {isRtl
                  ? 'قاعدة البيانات تفتقد أعمدة تتبع التعديلات (lawNameEn, status, إلخ). هذا يمنع نقطة list من العمل. انقر الزر أدناه لإضافة الأعمدة وإعادة تحميل المدوّنة.'
                  : 'The database is missing amendment-tracking columns (lawNameEn, status, etc.). This breaks the list endpoint. Click the button below to add the columns and re-seed the corpus.'}
              </div>
              <div className="text-[9px] text-rose-500 mt-1 font-mono">
                {migrateStatus.diagnosis}
              </div>
            </div>
          </div>

          {migrateStatus.enabled ? (
            <button
              onClick={handleMigrate}
              disabled={migrateLoading}
              className="w-full py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {migrateLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{isRtl ? 'جاري التحديث...' : 'Migrating...'}</span>
                </>
              ) : (
                <>
                  <DatabaseZap className="w-3.5 h-3.5 shrink-0" />
                  <span>{isRtl ? 'تحديث قاعدة البيانات الآن' : 'Update database now'}</span>
                </>
              )}
            </button>
          ) : (
            <div className="text-[10px] text-rose-700 bg-rose-100 border border-rose-200 rounded-lg p-2">
              {isRtl
                ? 'لتفعيل هذا الزر، اضبط RAG_SEED_ENABLED=1 في Vercel → Settings → Environment Variables ثم أعد النشر.'
                : 'To enable this button, set RAG_SEED_ENABLED=1 in Vercel → Settings → Environment Variables, then redeploy.'}
            </div>
          )}

          {migrateError && (
            <div className="text-[10px] text-rose-700 bg-rose-100 border border-rose-200 rounded-lg p-2">
              {migrateError}
            </div>
          )}

          {migrateResult?.ok && (
            <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <div className="font-bold mb-0.5">✓ {isRtl ? 'اكتمل التحديث' : 'Migration complete'}</div>
              <div>
                {isRtl
                  ? `تم تحديث ${migrateResult.summary?.totalArticles ?? 31} مادة. الآن اضبط RAG_SEED_ENABLED=0 وأعد النشر.`
                  : `${migrateResult.summary?.totalArticles ?? 31} articles updated. Now set RAG_SEED_ENABLED=0 and redeploy.`}
              </div>
            </div>
          )}

          {migrateResult && !migrateResult.ok && (
            <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <div className="font-bold mb-0.5">⚠ {isRtl ? 'تحديث جزئي' : 'Partial migration'}</div>
              {migrateResult.steps?.map((s: any, i: number) => (
                <div key={i} className={s.ok ? 'text-emerald-700' : 'text-rose-700'}>
                  {s.ok ? '✓' : '✗'} {s.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- One-click RAG setup (Managing Partner only, only when RAG_SEED_ENABLED=1 AND not fully setup) --- */}
      {isManagingPartner && setupStatus?.enabled && !setupStatus.fullySetup && (
        <div className="border border-primary/30 bg-primary/5 rounded-2xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <DatabaseZap className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <div className="flex-grow min-w-0">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                {isRtl ? 'إعداد RAG بنقرة واحدة (للمدير فقط)' : 'One-click RAG setup (Managing Partner only)'}
              </div>
              <div className="text-[10px] text-primary mt-0.5 leading-relaxed">
                {isRtl
                  ? 'هذا الزر ينشئ كل شيء: الجداول، تفعيل pgvector، الفهارس، دوال البحث، وتحميل 31 مادة قانونية بتضميناتها. لا حاجة لأي SQL أو طرفية.'
                  : 'This button creates everything: tables, pgvector extension, indexes, search functions, and seeds 31 legal articles with embeddings. No SQL or terminal needed.'}
              </div>

              {/* Status checklist */}
              <div className="mt-2 space-y-0.5 text-[10px] font-mono">
                <SetupCheck done={setupStatus.tablesExist} label={isRtl ? 'الجداول' : 'Tables'} />
                <SetupCheck done={setupStatus.pgvectorEnabled} label={isRtl ? 'pgvector' : 'pgvector'} />
                <SetupCheck done={setupStatus.embeddingColumnsExist} label={isRtl ? 'أعمدة التضمين' : 'Embedding cols'} />
                <SetupCheck done={setupStatus.matchFunctionExists} label={isRtl ? 'دوال البحث' : 'Match functions'} />
                <SetupCheck
                  done={setupStatus.withEmbeddings >= 31}
                  label={isRtl ? `المدوّنة (${setupStatus.withEmbeddings}/31)` : `Corpus (${setupStatus.withEmbeddings}/31)`}
                />
              </div>

              {!setupStatus.hasGeminiKey && (
                <div className="text-[10px] text-red-600 mt-2 font-semibold">
                  {isRtl
                    ? '⚠ GEMINI_API_KEY غير مضبوط على الخادم. أضفه في Vercel → Settings → Environment Variables ثم أعد النشر.'
                    : '⚠ GEMINI_API_KEY not set on server. Add it in Vercel → Settings → Environment Variables, then redeploy.'}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSetup}
            disabled={setupLoading || !setupStatus.hasGeminiKey}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {setupLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{isRtl ? 'جاري الإعداد (1-2 دقيقة)...' : 'Setting up (~1-2 min)...'}</span>
              </>
            ) : (
              <>
                <DatabaseZap className="w-3.5 h-3.5 shrink-0" />
                <span>{isRtl ? 'إعداد RAG بنقرة واحدة' : 'Set up RAG in one click'}</span>
              </>
            )}
          </button>

          {setupError && (
            <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              {setupError}
            </div>
          )}

          {setupResult && (
            <div className="text-[10px] text-foreground bg-white border border-border rounded-lg p-2.5">
              <div className={`font-bold mb-1 ${setupResult.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                {setupResult.ok
                  ? (isRtl ? '✓ اكتمل الإعداد بنجاح' : '✓ Setup complete')
                  : (isRtl ? '⚠ اكتمل الإعداد جزئياً' : '⚠ Setup partially complete')}
              </div>
              {setupResult.steps?.map((s: any, i: number) => (
                <div key={i} className={`flex items-start gap-1.5 ${s.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                  <span className="font-mono shrink-0">{s.ok ? '✓' : '✗'}</span>
                  <span className="flex-grow">
                    <span className="font-semibold">Step {s.step}:</span> {s.message}
                    {s.detail && <span className="block text-muted-foreground mt-0.5 font-mono text-[9px]">{s.detail}</span>}
                  </span>
                </div>
              ))}
              {setupResult.textFallbackOnly && (
                <div className="mt-1.5 text-amber-700">
                  {isRtl
                    ? '⚠ تعذّر تفعيل pgvector من داخل التطبيق. RAG يعمل في وضع البحث النصي فقط. لتفعيل البحث الدلالي، فعّل إضافة pgvector من Vercel → Storage → Postgres → Settings.'
                    : '⚠ pgvector could not be enabled from app code. RAG is running in text-search mode. To enable semantic search, enable the pgvector extension from Vercel → Storage → Postgres → Settings.'}
                </div>
              )}
              {setupResult.ok && (
                <div className="mt-1.5 text-muted-foreground">
                  {isRtl
                    ? 'الآن جرّب طرح سؤال. ثم اذهب إلى Vercel → Settings → Environment Variables واضبط RAG_SEED_ENABLED=0 وأعد النشر لإخفاء هذا الزر.'
                    : 'Try asking a question now. Then go to Vercel → Settings → Environment Variables, set RAG_SEED_ENABLED=0, and redeploy to hide this button.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toggles */}
      <div className="flex flex-wrap gap-2">
        <ToggleChip
          active={includeMatter}
          onClick={() => setIncludeMatter((v) => !v)}
          icon={<FileText className="w-3.5 h-3.5" />}
          label={t.ragToggleMatter}
        />
        <ToggleChip
          active={includeCorpus}
          onClick={() => setIncludeCorpus((v) => !v)}
          icon={<Scale className="w-3.5 h-3.5" />}
          label={t.ragToggleCorpus}
        />
      </div>

      {/* Question input */}
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.ragPlaceholder}
          rows={3}
          className="w-full text-sm border border-border rounded-2xl p-4 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-100 leading-normal resize-none"
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground font-mono">
          ⌘+↵
        </div>
      </div>

      {/* Ask button */}
      <button
        onClick={handleAsk}
        disabled={loading || !question.trim() || (!includeMatter && !includeCorpus)}
        className="w-full py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:bg-primary shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>{t.ragThinking}</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4 shrink-0" />
            <span>{t.ragAskBtn}</span>
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div className="flex flex-col gap-3 overflow-y-auto flex-grow pr-1">
          {/* Status badge row */}
          <div className="flex flex-wrap items-center gap-2">
            {answer.noSources ? (
              <Badge variant="warn">
                <XCircle className="w-3.5 h-3.5" />
                <span>{t.ragNoSources}</span>
              </Badge>
            ) : answer.grounded ? (
              <Badge variant="good">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.ragGrounded.replace('{n}', String(answer.sources.length))}</span>
              </Badge>
            ) : (
              <Badge variant="warn">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t.ragUngrounded}</span>
              </Badge>
            )}
            {answer.matterHits > 0 && (
              <Badge variant="neutral">
                <Database className="w-3 h-3" />
                <span>{t.ragMatterHits.replace('{n}', String(answer.matterHits))}</span>
              </Badge>
            )}
            {answer.corpusHits > 0 && (
              <Badge variant="neutral">
                <Scale className="w-3 h-3" />
                <span>{t.ragCorpusHits.replace('{n}', String(answer.corpusHits))}</span>
              </Badge>
            )}
            {answer._textFallback && (
              <Badge variant="warn">
                <AlertTriangle className="w-3 h-3" />
                <span>{t.ragTextFallback}</span>
              </Badge>
            )}
          </div>

          {/* Answer text */}
          <div
            className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-white border border-border rounded-2xl p-4"
            dir={answer.lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {answer.answer || (isRtl ? '—' : '—')}
          </div>

          {/* Sources */}
          {answer.sources.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>{t.ragSourcesTitle} ({answer.sources.length})</span>
              </div>
              {answer.sources.map((src, i) => (
                <SourceChip
                  key={i}
                  index={i}
                  citation={src}
                  expanded={expandedSource === i}
                  onToggle={() => setExpandedSource(expandedSource === i ? null : i)}
                  t={t}
                  isRtl={isRtl}
                />
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <div className="text-[10px] text-muted-foreground italic border-t border-border pt-2 mt-1">
            {answer.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white text-muted-foreground border-border hover:bg-card'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Badge({
  variant,
  children,
}: {
  variant: 'good' | 'warn' | 'neutral';
  children: React.ReactNode;
}) {
  const styles = {
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    neutral: 'bg-card text-muted-foreground border-border',
  }[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles}`}
    >
      {children}
    </span>
  );
}

function SourceChip({
  index,
  citation,
  expanded,
  onToggle,
  t,
  isRtl,
}: {
  index: number;
  citation: Citation;
  expanded: boolean;
  onToggle: () => void;
  t: any;
  isRtl: boolean;
}) {
  const typeLabel =
    citation.type === 'statute'
      ? t.ragSourceStatute
      : citation.type === 'transcript'
        ? t.ragSourceTranscript
        : t.ragSourceDocument;

  const TypeIcon =
    citation.type === 'statute'
      ? Scale
      : citation.type === 'transcript'
        ? MessageSquare
        : FileText;

  // Primary citation label.
  let primary: string;
  if (citation.type === 'statute') {
    primary = `${citation.lawName ?? ''} — م${citation.articleNumber ?? '?'}`;
    if (citation.title) primary += ` (${citation.title})`;
  } else if (citation.type === 'transcript') {
    primary = `${citation.documentName ?? t.ragSourceTranscript} — ${isRtl ? 'ص' : 'p'}.${citation.pageNumber ?? '?'}`;
  } else {
    primary = citation.documentName ?? t.ragSourceDocument;
    if (citation.chunkIndex !== undefined) primary += ` · #${citation.chunkIndex}`;
  }

  return (
    <div className="border border-border rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-2.5 text-xs hover:bg-card transition-colors cursor-pointer text-left"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-2 min-w-0 flex-grow">
          <TypeIcon className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[9px] font-bold uppercase tracking-wide shrink-0">
            {typeLabel}
          </span>
          <span className="font-semibold text-foreground truncate">{primary}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 pt-0">
          <div
            className="text-[11px] text-muted-foreground leading-relaxed bg-card border border-border rounded-lg p-2.5 whitespace-pre-wrap"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {citation.excerpt}
          </div>
          {citation.sourceUrl && (
            <a
              href={citation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-primary hover:text-primary font-semibold"
            >
              <BookOpen className="w-3 h-3" />
              <span>{isRtl ? 'المصدر الرسمي' : 'Official source'}</span>
            </a>
          )}
          {/* Deep link to document / transcript (best-effort — the matter
              workspace is the destination, not a specific page anchor, because
              the existing UI doesn't expose deep links to individual pages.) */}
          {citation.type !== 'statute' && (citation.documentId || citation.transcriptId) && (
            <span className="inline-flex items-center gap-1 mt-1.5 ml-2 text-[10px] text-muted-foreground">
              <FileText className="w-3 h-3" />
              <span>{isRtl ? 'متاح في ملفات القضية' : 'Available in matter files'}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SetupCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${done ? 'text-emerald-600' : 'text-muted-foreground'}`}>
      <span className="font-mono">{done ? '✓' : '○'}</span>
      <span>{label}</span>
    </div>
  );
}
