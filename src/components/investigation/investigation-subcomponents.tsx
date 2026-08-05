'use client';

// =============================================================================
// InvestigationModule sub-components (kept in a separate file for readability)
// =============================================================================

import React, { useState } from 'react';
import {
  FileSearch,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Gavel,
  ChevronDown,
  ChevronRight,
  Clock,
  ShieldCheck,
  ScrollText,
  RefreshCw,
  Download,
  FileDown,
} from 'lucide-react';
import type { Matter } from '@/lib/types';

interface InvestigationListItem {
  id: string;
  title: string;
  status: string;
  verificationTier: string;
  lang: string;
  matterId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InvestigationDetail {
  id: string;
  title: string;
  status: string;
  verificationTier: string;
  lang: string;
  matterId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  intake: any;
  research: any;
  courtRouting: any;
  draft: {
    templateId: string | null;
    sections: Array<{
      sectionKey: string;
      heading: string;
      body: string;
      citationIds: string[];
    }>;
    renderedText: string | null;
  } | null;
  citationVerifications: Array<{
    id: string;
    claimedCitation: string;
    status: string;
    corpusId: string | null;
    similarity: number | null;
    reason: string | null;
  }>;
  factChecks: Array<{
    id: string;
    factText: string;
    status: string;
    reason: string | null;
    intakeValue: string | null;
  }>;
  assembly: any;
  reviews: Array<{
    id: string;
    decision: string;
    note: string | null;
    reviewerId: string;
    createdAt: string;
  }>;
  agentRuns: any[];
}

export function PaywallView({ isAr, onUpgrade }: { isAr: boolean; onUpgrade: () => void }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 border border-slate-700 shadow-xl">
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-4">
        <div className="p-4 bg-amber-500 text-slate-950 rounded-2xl shadow-lg">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">
            {isAr ? 'وكيل تحقيق القضايا — إضافة مدفوعة' : 'Case Investigation Agent — Paid Add-on'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {isAr
              ? 'خط أنابيب من سبعة وكلاء ذكاء اصطناعي ينتج حزمة تحقيق منظمة بالاستشهادات الموثقة من المدوّنة الأردنية، مع تحقق مستقل ومراجعة المحامي قبل الإخراج النهائي. متاح فقط للمكاتب المفعّل لديها هذه الإضافة.'
              : 'A seven-agent AI pipeline that produces a structured, citation-backed investigation package — with independent citation + fact verification and an attorney review gate before final output. Available only to organizations with this add-on enabled.'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-2">
          {[
            { icon: ShieldCheck, ar: 'تحقق مستقل من الاستشهادات', en: 'Independent citation verification' },
            { icon: Gavel, ar: 'بوابة مراجعة المحامي', en: 'Attorney review gate' },
            { icon: ScrollText, ar: 'استشهادات من المدوّنة فقط', en: 'Corpus-verified citations only' },
          ].map((f, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
              <f.icon className="w-5 h-5 text-amber-400 mx-auto mb-2" />
              <p className="text-[11px] text-slate-300 leading-tight">{isAr ? f.ar : f.en}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onUpgrade}
          className="mt-4 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl transition shadow-lg flex items-center gap-2"
        >
          <Lock className="w-4 h-4" />
          {isAr ? 'ترقية لتفعيل الإضافة' : 'Upgrade to Unlock'}
        </button>
        <p className="text-[10px] text-slate-400 mt-1">
          {isAr
            ? 'الإضافة مفعّلة على مستوى المؤسسة. تواصل مع مدير حسابك لتفعيلها.'
            : 'Add-on is enabled at the organization level. Contact your account manager to enable.'}
        </p>
      </div>
    </div>
  );
}

export function ListView({
  isAr,
  isRtl,
  list,
  loading,
  onOpen,
  onNew,
}: {
  isAr: boolean;
  isRtl: boolean;
  list: InvestigationListItem[];
  loading: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <FileSearch className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-sm font-bold mb-1">{isAr ? 'لا توجد تحقيقات بعد' : 'No investigations yet'}</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
          {isAr ? 'ابدأ تحقيقك الأول لرؤية خط الأنابيب متعدد الوكلاء يعمل.' : 'Start your first investigation to see the multi-agent pipeline in action.'}
        </p>
        <button onClick={onNew} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition">
          {isAr ? 'بدء تحقيق جديد' : 'Start New Investigation'}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((inv) => (
        <button
          key={inv.id}
          onClick={() => onOpen(inv.id)}
          className="w-full bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition text-left rtl:text-right flex items-center justify-between gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-bold truncate">{inv.title}</h4>
              <StatusBadge status={inv.status} isAr={isAr} />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {isAr ? `المستوى ${inv.verificationTier}` : `Tier ${inv.verificationTier}`}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(inv.createdAt).toLocaleDateString(isAr ? 'ar' : 'en')}
              </span>
              {inv.failureReason && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="w-3 h-3" />
                  {isAr ? 'فشل' : 'Failed'}
                </span>
              )}
            </div>
          </div>
          {isRtl ? <ArrowLeft className="w-4 h-4 text-muted-foreground" /> : <ArrowRight className="w-4 h-4 text-muted-foreground" />}
        </button>
      ))}
    </div>
  );
}

export function NewInvestigationForm({
  isAr,
  title,
  intakeInput,
  tier,
  lang,
  activeMatter,
  starting,
  onTitle,
  onIntake,
  onTier,
  onLang,
  onSubmit,
}: {
  isAr: boolean;
  title: string;
  intakeInput: string;
  tier: '1' | '2' | '3';
  lang: 'ar' | 'en';
  activeMatter: Matter | null;
  starting: boolean;
  onTitle: (v: string) => void;
  onIntake: (v: string) => void;
  onTier: (v: '1' | '2' | '3') => void;
  onLang: (v: 'ar' | 'en') => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <label className="block text-xs font-bold mb-1.5">{isAr ? 'عنوان التحقيق' : 'Investigation title'}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder={isAr ? 'مثال: خرق عقد — شركة أ vs شركة ب' : 'e.g. Breach of contract — Acme vs Beta'}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          required
          maxLength={300}
        />
      </div>

      <div>
        <label className="block text-xs font-bold mb-1.5">
          {isAr ? 'نص الاستيعاب (الشكوى، الوقائع، أي مستند أولي)' : 'Intake text (complaint, facts, any initial document)'}
        </label>
        <textarea
          value={intakeInput}
          onChange={(e) => onIntake(e.target.value)}
          placeholder={
            isAr
              ? 'الصق هنا نص الشكوى أو الوقائع أو أي مستند أولي. سيقوم وكيل الاستيعاب باستخراج الأطراف والادعاءات والوقائع والتواريخ والمبالغ مع ربط كل عنصر بمصدر.'
              : 'Paste the complaint text, factual narrative, or any initial document. The Intake Agent will extract parties, claims, facts, dates, and amounts — each with a source anchor.'
          }
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
          required
          minLength={20}
          maxLength={20000}
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {isAr ? `الحد الأدنى 20 حرف. الحد الأقصى 20,000 حرف. (${intakeInput.length} حرف)` : `Min 20 chars. Max 20,000 chars. (${intakeInput.length} chars)`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold mb-1.5">{isAr ? 'مستوى التحقق' : 'Verification tier'}</label>
          <select
            value={tier}
            onChange={(e) => onTier(e.target.value as '1' | '2' | '3')}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="1">{isAr ? 'المستوى 1 — صارم' : 'Tier 1 — Strictest'}</option>
            <option value="2">{isAr ? 'المستوى 2 — افتراضي' : 'Tier 2 — Default'}</option>
            <option value="3">{isAr ? 'المستوى 3 — استشاري' : 'Tier 3 — Advisory'}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5">{isAr ? 'لغة الإخراج' : 'Output language'}</label>
          <select
            value={lang}
            onChange={(e) => onLang(e.target.value as 'ar' | 'en')}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ar">{isAr ? 'العربية' : 'Arabic'}</option>
            <option value="en">{isAr ? 'الإنجليزية' : 'English'}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5">{isAr ? 'القضية المرتبطة' : 'Linked matter'}</label>
          <div className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground truncate">
            {activeMatter ? activeMatter.title : (isAr ? 'بدون قضية (مستقل)' : 'None (standalone)')}
          </div>
        </div>
      </div>

      <div className="bg-muted/30 border border-border rounded-lg p-3 text-[11px] text-muted-foreground">
        <strong className="text-foreground">{isAr ? 'ملاحظة:' : 'Note:'}</strong>{' '}
        {isAr
          ? 'خط الأنابيب يعمل بشكل متزامن. قد يستغرق 30–90 ثانية حسب طول النص. سيتم تحويلك تلقائياً لعرض التفاصيل.'
          : 'The pipeline runs synchronously. Expect 30–90 seconds depending on intake length. You will be redirected to the detail view automatically.'}
      </div>

      <button
        type="submit"
        disabled={starting || !title.trim() || intakeInput.trim().length < 20}
        className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        {starting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {isAr ? 'جاري تشغيل خط الأنابيب...' : 'Running pipeline...'}
          </>
        ) : (
          <>
            <FileSearch className="w-4 h-4" />
            {isAr ? 'بدء التحقيق' : 'Start Investigation'}
          </>
        )}
      </button>
    </form>
  );
}

export function DetailView({
  isAr,
  detail,
  loading,
  onRefresh,
  onReviewed,
}: {
  isAr: boolean;
  isRtl: boolean;
  detail: InvestigationDetail | null;
  loading: boolean;
  onRefresh: () => void;
  onReviewed: () => void;
}) {
  if (loading && !detail) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center text-xs text-muted-foreground">
        {isAr ? 'تعذّر تحميل التحقيق.' : 'Failed to load investigation.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-bold">{detail.title}</h3>
            <StatusBadge status={detail.status} isAr={isAr} />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{isAr ? `المستوى ${detail.verificationTier}` : `Tier ${detail.verificationTier}`}</span>
            <span>{detail.lang === 'ar' ? 'العربية' : 'English'}</span>
            <span>{new Date(detail.createdAt).toLocaleString(isAr ? 'ar' : 'en')}</span>
          </div>
          {detail.failureReason && (
            <div className="mt-2 bg-destructive/10 border border-destructive/30 text-destructive text-[11px] rounded p-2">
              {detail.failureReason}
            </div>
          )}
        </div>
        <button onClick={onRefresh} className="p-2 border border-border rounded-lg hover:bg-accent transition" title={isAr ? 'تحديث' : 'Refresh'}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <PipelineStages detail={detail} isAr={isAr} />
      {detail.draft && <DraftView draft={detail.draft} isAr={isAr} />}
      {(detail.citationVerifications.length > 0 || detail.factChecks.length > 0) && (
        <VerificationView
          citations={detail.citationVerifications}
          factChecks={detail.factChecks}
          tier={detail.verificationTier}
          isAr={isAr}
        />
      )}
      {detail.status === 'awaiting_attorney_review' && detail.assembly && (
        <AttorneyReviewPanel investigationId={detail.id} isAr={isAr} onReviewed={onReviewed} />
      )}
      {detail.reviews.length > 0 && <ReviewHistory reviews={detail.reviews} isAr={isAr} />}

      {/* ─── Download PDF Report & Generate Document ─── */}
      {detail.assembly && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <FileDown className="w-4 h-4 text-primary" />
            {isAr ? 'تصدير المستندات' : 'Document Export'}
          </h4>
          <div className="flex flex-wrap gap-2">
            <DownloadPdfButton investigationId={detail.id} isAr={isAr} />
            <GenerateDocumentButton investigationId={detail.id} isAr={isAr} />
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineStages({ detail, isAr }: { detail: InvestigationDetail; isAr: boolean }) {
  const stages: Array<{ name: string; labelAr: string; labelEn: string; status: string | null }> = [
    { name: 'intake', labelAr: 'الاستيعاب', labelEn: 'Intake', status: detail.intake ? 'passed' : null },
    { name: 'research', labelAr: 'البحث', labelEn: 'Research', status: detail.research ? 'passed' : null },
    { name: 'court_routing', labelAr: 'الاختصاص', labelEn: 'Court Routing', status: detail.courtRouting ? 'passed' : null },
    { name: 'drafting', labelAr: 'الصياغة', labelEn: 'Drafting', status: detail.draft ? 'passed' : null },
    {
      name: 'citation_verify',
      labelAr: 'تحقق الاستشهادات',
      labelEn: 'Citation Verify',
      status: detail.citationVerifications.length > 0
        ? (detail.citationVerifications.every((c) => c.status === 'verified' || c.status === 'amended' || c.status === 'superseded') ? 'passed' : 'failed')
        : null,
    },
    {
      name: 'fact_consistency',
      labelAr: 'اتساق الوقائع',
      labelEn: 'Fact Consistency',
      status: detail.factChecks.length > 0
        ? (detail.factChecks.every((f) => f.status === 'consistent' || f.status === 'unverifiable') ? 'passed' : (detail.factChecks.some((f) => f.status === 'inconsistent') ? 'failed' : 'passed'))
        : null,
    },
    { name: 'assembler', labelAr: 'التجميع', labelEn: 'Assembler', status: detail.assembly ? 'passed' : null },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-muted-foreground">
        {isAr ? 'مراحل خط الأنابيب' : 'Pipeline Stages'}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {stages.map((s) => (
          <div
            key={s.name}
            className={`rounded-lg p-2 border text-center ${
              s.status === 'passed'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : s.status === 'failed'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <div className="flex items-center justify-center mb-1">
              {s.status === 'passed' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : s.status === 'failed' ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-pulse" />
              )}
            </div>
            <p className="text-[10px] font-bold leading-tight">{isAr ? s.labelAr : s.labelEn}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftView({ draft, isAr }: { draft: NonNullable<InvestigationDetail['draft']>; isAr: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left rtl:text-right">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {isAr ? 'مسودة التحقيق' : 'Investigation Draft'}
        </h4>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {draft.sections.map((s, i) => (
            <div key={i} className="border-l-2 border-primary/40 pl-3 rtl:border-l-0 rtl:border-r-2 rtl:pl-0 rtl:pr-3">
              <h5 className="text-xs font-bold mb-1">{s.heading}</h5>
              <pre className="text-[11px] whitespace-pre-wrap font-sans text-foreground/80 leading-relaxed">{s.body}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VerificationView({
  citations,
  factChecks,
  tier,
  isAr,
}: {
  citations: InvestigationDetail['citationVerifications'];
  factChecks: InvestigationDetail['factChecks'];
  tier: string;
  isAr: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left rtl:text-right">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {isAr ? 'نتائج التحقق' : 'Verification Results'}
          <span className="ml-2 rtl:ml-0 rtl:mr-2 text-[10px] text-muted-foreground/70">
            ({citations.length} {isAr ? 'استشهاد' : 'citations'}, {factChecks.length} {isAr ? 'واقعة' : 'facts'})
          </span>
        </h4>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {citations.length > 0 && (
            <div>
              <h5 className="text-[11px] font-bold mb-2 text-muted-foreground">
                {isAr ? 'الاستشهادات (تحقق إلزامي)' : 'Citations (blocking)'}
              </h5>
              <div className="space-y-1.5">
                {citations.map((c) => (
                  <div key={c.id} className="text-[11px] border border-border rounded p-2 flex items-start gap-2">
                    {c.status === 'verified' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : c.status === 'amended' || c.status === 'superseded' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px]">{c.claimedCitation}</div>
                      <div className="text-muted-foreground mt-0.5">
                        <strong>{c.status}</strong>
                        {c.reason ? ` — ${c.reason}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {factChecks.length > 0 && (
            <div>
              <h5 className="text-[11px] font-bold mb-2 text-muted-foreground">
                {isAr ? `الوقائع (${tier === '3' ? 'استشاري' : 'إلزامي'})` : `Facts (${tier === '3' ? 'advisory' : 'blocking'})`}
              </h5>
              <div className="space-y-1.5">
                {factChecks.map((f) => (
                  <div key={f.id} className="text-[11px] border border-border rounded p-2 flex items-start gap-2">
                    {f.status === 'consistent' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : f.status === 'unverifiable' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div>{f.factText}</div>
                      <div className="text-muted-foreground mt-0.5">
                        <strong>{f.status}</strong>
                        {f.reason ? ` — ${f.reason}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttorneyReviewPanel({
  investigationId,
  isAr,
  onReviewed,
}: {
  investigationId: string;
  isAr: boolean;
  onReviewed: () => void;
}) {
  const [decision, setDecision] = useState<'approve' | 'reject' | 'request_changes'>('approve');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if ((decision === 'reject' || decision === 'request_changes') && note.trim().length < 3) {
      setError(isAr ? 'ملاحظة مطلوبة (3 أحرف على الأقل) للرفض أو طلب التعديل.' : 'Note required (min 3 chars) for reject / request changes.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigations/${investigationId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setNote('');
      onReviewed();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gavel className="w-4 h-4 text-amber-600" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {isAr ? 'بوابة مراجعة المحامي' : 'Attorney Review Gate'}
        </h4>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        {isAr ? 'هذه الحزمة في انتظار مراجعتك. يجب الموافقة قبل اعتمادها كنهائية.' : 'This package is awaiting your review. Approval is required before it is finalized.'}
      </p>
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(['approve', 'request_changes', 'reject'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDecision(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                decision === d
                  ? d === 'approve'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : d === 'reject'
                      ? 'bg-destructive text-white border-destructive'
                      : 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {d === 'approve' ? (isAr ? 'موافقة' : 'Approve') : d === 'reject' ? (isAr ? 'رفض' : 'Reject') : (isAr ? 'طلب تعديل' : 'Request Changes')}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={decision === 'approve' ? (isAr ? 'ملاحظة اختيارية...' : 'Optional note...') : (isAr ? 'ملاحظة مطلوبة (اشرح السبب)...' : 'Note required (explain why)...')}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
          maxLength={5000}
        />
        {error && (
          <div className="text-[11px] text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isAr ? 'تقديم المراجعة' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}

function ReviewHistory({ reviews, isAr }: { reviews: InvestigationDetail['reviews']; isAr: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {isAr ? 'سجل المراجعة' : 'Review History'}
      </h4>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="text-[11px] border border-border rounded p-2">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={r.decision === 'approve' ? 'approve' : r.decision === 'reject' ? 'reject' : 'request_changes'} isAr={isAr} />
              <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString(isAr ? 'ar' : 'en')}</span>
            </div>
            {r.note && <p className="text-foreground/80">{r.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    queued: { ar: 'في الانتظار', en: 'Queued', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    running: { ar: 'قيد التشغيل', en: 'Running', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    awaiting_attorney_review: { ar: 'بانتظار المراجعة', en: 'Awaiting Review', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
    completed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    failed: { ar: 'فشل', en: 'Failed', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
    approve: { ar: 'موافقة', en: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    reject: { ar: 'رفض', en: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
    request_changes: { ar: 'طلب تعديل', en: 'Changes Requested', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  };
  const m = map[status] ?? { ar: status, en: status, cls: 'bg-muted text-muted-foreground' };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${m.cls}`}>{isAr ? m.ar : m.en}</span>
  );
}

// =============================================================================
// DownloadPdfButton — Feature 1: Download PDF Case Report
// =============================================================================

function DownloadPdfButton({ investigationId, isAr }: { investigationId: string; isAr: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/case-report-pdf?investigationId=${investigationId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch?.[1] || `CaseCraft-Report-${investigationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || (isAr ? 'فشل تحميل التقرير' : 'Failed to download report'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="px-3 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {isAr ? 'تحميل تقرير PDF' : 'Download PDF Report'}
    </button>
  );
}

// =============================================================================
// GenerateDocumentButton — Feature 2: Generate Legal Document (DOCX)
// =============================================================================

function GenerateDocumentButton({ investigationId, isAr }: { investigationId: string; isAr: boolean }) {
  const [loading, setLoading] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/generate-document');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTemplates(data.templates || []);
      setShowTemplatePicker(true);
    } catch {
      alert(isAr ? 'فشل تحميل القوالب' : 'Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleGenerate = async (templateId: string, lang: 'ar' | 'en') => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, investigationId, lang }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch?.[1] || `CaseCraft-Document.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShowTemplatePicker(false);
    } catch (err: any) {
      alert(err?.message || (isAr ? 'فشل إنشاء المستند' : 'Failed to generate document'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={fetchTemplates}
        disabled={templatesLoading}
        className="px-3 py-2 text-xs font-bold border border-border rounded-lg hover:bg-accent transition flex items-center gap-1.5 disabled:opacity-50"
      >
        {templatesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
        {isAr ? 'إنشاء مستند قانوني' : 'Generate Legal Document'}
      </button>

      {showTemplatePicker && (
        <div className="absolute z-50 top-full mt-2 left-0 min-w-[320px] bg-card border border-border rounded-xl shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{isAr ? 'اختر قالبًا' : 'Select Template'}</span>
            <button onClick={() => setShowTemplatePicker(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">{isAr ? 'لا توجد قوالب' : 'No templates available'}</p>
          ) : (
            templates.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent/50 transition">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{isAr && t.nameAr ? t.nameAr : t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.type} · {t.language || 'en'}</p>
                </div>
                <button
                  onClick={() => handleGenerate(t.id, (t.language || 'en') as 'ar' | 'en')}
                  disabled={loading}
                  className="px-2 py-1 text-[10px] font-bold bg-primary text-primary-foreground rounded hover:opacity-90 transition disabled:opacity-50 shrink-0"
                >
                  {loading ? '...' : (isAr ? 'إنشاء' : 'Generate')}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
