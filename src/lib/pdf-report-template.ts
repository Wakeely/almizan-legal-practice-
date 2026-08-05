// =============================================================================
// Al Mizan — PDF Case Report HTML template (server-side, Playwright HTML→PDF)
// =============================================================================
// Generates a professional legal PDF with full Arabic/RTL support.
// Arabic fonts (Noto Naskh Arabic + Noto Sans Arabic) are embedded as base64
// @font-face so Playwright's headless Chromium renders proper Arabic glyphs,
// ligatures, and bidirectional text with no tofu (□) characters.
// =============================================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import type { InvestigationPackage } from '@/lib/agents/types';

// ---------------------------------------------------------------------------
// Font embedding — read once at module level, cached across invocations
// ---------------------------------------------------------------------------

let _notoNaskhB64: string | null = null;
let _notoSansArabicB64: string | null = null;

function getFontBase64(filename: string): string {
  if (filename.includes('Naskh') && _notoNaskhB64) return _notoNaskhB64;
  if (filename.includes('Sans') && _notoSansArabicB64) return _notoSansArabicB64;
  const fontPath = join(process.cwd(), 'public', 'fonts', filename);
  const buffer = readFileSync(fontPath);
  const b64 = buffer.toString('base64');
  if (filename.includes('Naskh')) _notoNaskhB64 = b64;
  if (filename.includes('Sans')) _notoSansArabicB64 = b64;
  return b64;
}

// ---------------------------------------------------------------------------
// Template data shape — what the API route provides
// ---------------------------------------------------------------------------

export interface PdfReportInput {
  investigationId: string;
  package: InvestigationPackage;
  investigationTitle: string;
  lang: 'ar' | 'en';
  /** The matter title, if linked. */
  matterTitle?: string;
  /** Attorney review info, if any review exists. */
  attorneyReview?: {
    decision: string;
    note?: string;
    reviewedAt: string;
    reviewerName?: string;
  } | null;
}

// ---------------------------------------------------------------------------
// HTML generator
// ---------------------------------------------------------------------------

export function generatePdfHtml(input: PdfReportInput): string {
  const { lang, package: pkg, investigationTitle, attorneyReview } = input;
  const isRTL = lang === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';

  // Embed fonts
  const notoNaskh = getFontBase64('NotoNaskhArabic-Variable.ttf');
  const notoSansArabic = getFontBase64('NotoSansArabic-Variable.ttf');

  // Localization helpers
  const t = (ar: string, en: string) => isRTL ? ar : en;

  // Section labels
  const labels = {
    header: t('رأس القضية', 'Case Header'),
    parties: t('الأطراف', 'Parties'),
    jurisdiction: t('الاختصاص القضائي', 'Jurisdiction'),
    claim: t('بيان الدعوى / الادعاء', 'Claim / Statement of Claim'),
    relief: t('الطلبات المطلوبة', 'Relief Sought'),
    timeline: t('الجدول الزمني للتواريخ', 'Timeline of Dates'),
    facts: t('الوقائع الرئيسية', 'Key Facts'),
    citations: t('الاستشهادات', 'Citations'),
    advisory: t('علامات الاتساق / الاستشارة', 'Consistency / Advisory Flags'),
    attorneyNote: t('ملاحظة مراجعة المحامي', 'Attorney Review Note'),
    claimant: t('المدعي', 'Claimant'),
    respondent: t('المدعى عليه', 'Respondent'),
    source: t('المصدر', 'Source'),
    verified: t('تم التحقق', 'Verified'),
    failed: t('فشل التحقق', 'Failed'),
    notFound: t('غير موجود', 'Not Found'),
    amended: t('معدّل', 'Amended'),
    superseded: t('منسوخ', 'Superseded'),
    consistent: t('متسق', 'Consistent'),
    inconsistent: t('غير متسق', 'Inconsistent'),
    unverifiable: t('غير قابل للتحقق', 'Unverifiable'),
    disclaimer: t(
      'لم يقم CaseCraft / الميزan بإيداع أو تقديم أي شيء إلى أي محكمة. هذا المستند لأغراض مراجعة المحامي فقط ولا يشكل إيداعاً أو تقديماً رسمياً.',
      'CaseCraft / Al Mizan did not file or submit anything to any court. This document is for attorney review purposes only and does not constitute a filing or submission.'
    ),
    attorneyPackage: t('حزمة مراجعة المحامي — غير مودعة', 'Attorney Review Package – Not Filed'),
    tier: t('مستوى التحقق', 'Verification Tier'),
    lang: t('اللغة', 'Language'),
    generated: t('تاريخ الإنشاء', 'Generated'),
    notReviewed: t('لم تتم مراجعة هذه الحزمة من قبل محامٍ بعد.', 'This package has not yet been reviewed by an attorney.'),
    reviewed: t('تمت مراجعة هذه الحزمة والموافقة عليها من قبل محامٍ.', 'This package has been reviewed and approved by an attorney.'),
  };

  // Extract data from the InvestigationPackage
  const intake = pkg.intake;
  const draft = pkg.draft;
  const courtRouting = pkg.courtRouting;
  const citationVerifications = pkg.citationVerifications;
  const factChecks = pkg.factChecks;

  // Parties
  const plaintiffs = intake.parties.filter(p => p.role === 'plaintiff' || p.role === 'claimant');
  const defendants = intake.parties.filter(p => p.role === 'defendant' || p.role === 'respondent');

  // Build dates HTML
  const datesHtml = intake.dates.length === 0
    ? `<p class="empty-state">${t('لا توجد تواريخ', 'No dates recorded.')}</p>`
    : intake.dates.map(d => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div>
          <span class="timeline-date">${d.date}</span>
          <span class="timeline-label">${d.label}</span>
          <div class="timeline-source">${labels.source}: ${d.sourceAnchor.label}</div>
        </div>
      </div>
    `).join('');

  // Build facts HTML
  const factsHtml = intake.facts.length === 0
    ? `<p class="empty-state">${t('لم يتم استخراج وقائع', 'No facts extracted.')}</p>`
    : intake.facts.map(f => `
      <div class="fact-item">
        <div>${f.text}</div>
        <div class="fact-meta">
          <span class="fact-category">${f.category}</span>
          ${f.confidence !== undefined ? `<span class="fact-confidence">${(f.confidence * 100).toFixed(0)}%</span>` : ''}
        </div>
        <div class="fact-source">${labels.source}: ${f.sourceAnchor.label}</div>
      </div>
    `).join('');

  // Build citations HTML
  const citationsHtml = citationVerifications.length === 0
    ? `<p class="empty-state">${t('لا توجد استشهادات', 'No citations.')}</p>`
    : citationVerifications.map(c => {
      const statusLabel = c.status === 'verified' ? labels.verified
        : c.status === 'failed' ? labels.failed
        : c.status === 'not_found' ? labels.notFound
        : c.status === 'amended' ? labels.amended
        : labels.superseded;
      return `
        <div class="citation-item">
          <div class="citation-ref">${c.claimedCitation}</div>
          <span class="citation-status status-${c.status}">${statusLabel}</span>
          ${c.reason ? `<div class="citation-reason">${c.reason}</div>` : ''}
        </div>
      `;
    }).join('');

  // Build fact checks (advisory) HTML
  const advisoryHtml = factChecks.length === 0
    ? `<p class="empty-state">${t('لا توجد علامات استشارية', 'No advisory flags.')}</p>`
    : factChecks.map(f => {
      const statusLabel = f.status === 'consistent' ? labels.consistent
        : f.status === 'inconsistent' ? labels.inconsistent
        : labels.unverifiable;
      const cls = f.status === 'consistent' ? 'severity-info'
        : f.status === 'inconsistent' ? 'severity-critical'
        : 'severity-warning';
      return `
        <div class="advisory-item ${cls}">
          <div class="flag-type">${statusLabel}</div>
          <div>${f.factText}</div>
          ${f.reason ? `<div class="flag-reason">${f.reason}</div>` : ''}
        </div>
      `;
    }).join('');

  // Draft sections HTML (Claim + Relief)
  const claimSection = draft.sections.find(s => s.sectionKey === 'claims' || s.sectionKey === 'claim' || s.sectionKey === 'background');
  const reliefSection = draft.sections.find(s => s.sectionKey === 'relief' || s.sectionKey === 'relief_sought');

  // Attorney review HTML
  const reviewHtml = attorneyReview
    ? `
      <div class="section">
        <div class="section-heading">${labels.attorneyNote}</div>
        <div class="attorney-note">
          <p>${attorneyReview.note || (attorneyReview.decision === 'approve' ? labels.reviewed : t('تم رفض الحزمة.', 'Package was rejected.'))}</p>
          <p class="review-meta">${attorneyReview.reviewerName ? `${attorneyReview.reviewerName} — ` : ''}${attorneyReview.reviewedAt}</p>
        </div>
      </div>
    `
    : `
      <div class="section">
        <div class="section-heading">${labels.attorneyNote}</div>
        <p class="empty-state">${labels.notReviewed}</p>
      </div>
    `;

  // Court routing HTML
  const courtHtml = courtRouting.noMatch
    ? `<p class="empty-state">${t('لم يتم تحديد محكمة', 'No court could be resolved.')}</p>`
    : `
      <p class="jurisdiction-name">${isRTL && courtRouting.courtNameAr ? courtRouting.courtNameAr : courtRouting.courtNameEn || ''}</p>
      ${courtRouting.courtCode ? `<p class="jurisdiction-code">${courtRouting.courtCode}</p>` : ''}
      ${courtRouting.routingReason ? `<p class="jurisdiction-reason">${courtRouting.routingReason.rule}</p>` : ''}
    `;

  const now = new Date();
  const dateStr = now.toLocaleDateString(isRTL ? 'ar-JO' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <style>
    @font-face {
      font-family: 'Noto Naskh Arabic';
      src: url('data:font/truetype;base64,${notoNaskh}') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Noto Sans Arabic';
      src: url('data:font/truetype;base64,${notoSansArabic}') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fff;
      text-align: ${textAlign};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 18mm 16mm;
    }

    /* Header */
    .report-header {
      border-bottom: 3px solid #0e4f6e;
      padding-bottom: 14px;
      margin-bottom: 22px;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 6px;
    }
    .brand-name {
      font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', sans-serif;
      font-size: 18pt;
      font-weight: 800;
      color: #0e4f6e;
    }
    .brand-sub {
      font-size: 9pt;
      color: #7f8c8d;
      letter-spacing: 0.5px;
    }
    .header-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 20px;
      font-size: 9pt;
      color: #555;
      margin-top: 10px;
    }
    .header-meta .label {
      color: #888;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .attorney-badge {
      display: inline-block;
      background: #f0f4f8;
      border: 1px solid #bdc3c7;
      border-radius: 4px;
      padding: 4px 12px;
      font-size: 8.5pt;
      color: #555;
      font-style: italic;
      margin-top: 6px;
    }
    .case-title {
      font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', sans-serif;
      font-size: 14pt;
      font-weight: 700;
      color: #0e4f6e;
      margin-top: 14px;
      line-height: 1.4;
    }

    /* Sections */
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section-heading {
      font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', sans-serif;
      font-size: 12pt;
      font-weight: 700;
      color: #0e4f6e;
      border-bottom: 1.5px solid #e0e0e0;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    /* Parties */
    .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .party-card { background: #f8f9fa; border-radius: 6px; padding: 10px 14px; }
    .party-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 3px; }
    .party-name { font-size: 11pt; font-weight: 600; color: #0e4f6e; }

    /* Content */
    .content-text { white-space: pre-line; line-height: 1.8; }

    /* Timeline */
    .timeline-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
    .timeline-dot { width: 7px; height: 7px; border-radius: 50%; background: #0e4f6e; margin-top: 6px; flex-shrink: 0; }
    .timeline-date { font-weight: 600; font-size: 10pt; color: #0e4f6e; }
    .timeline-label { font-size: 10pt; margin-${isRTL ? 'right' : 'left'}: 8px; }
    .timeline-source { font-size: 8pt; color: #999; font-style: italic; margin-top: 2px; }

    /* Facts */
    .fact-item {
      background: #fafbfc;
      border-${isRTL ? 'right' : 'left'}: 3px solid #3498db;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 7px;
    }
    .fact-meta { margin-top: 3px; }
    .fact-category { font-size: 8pt; color: #666; background: #eef; border-radius: 3px; padding: 1px 5px; display: inline-block; }
    .fact-confidence { font-size: 8pt; color: #666; background: #efe; border-radius: 3px; padding: 1px 5px; display: inline-block; margin-${isRTL ? 'left' : 'right'}: 6px; }
    .fact-source { font-size: 8pt; color: #888; margin-top: 2px; }

    /* Citations */
    .citation-item { padding: 7px 0; border-bottom: 1px solid #f0f0f0; }
    .citation-ref { font-size: 10pt; font-weight: 500; }
    .citation-reason { font-size: 8pt; color: #777; margin-top: 2px; }
    .citation-status { font-size: 8pt; padding: 2px 7px; border-radius: 3px; display: inline-block; margin-top: 3px; margin-${isRTL ? 'left' : 'right'}: 8px; }
    .status-verified { background: #e8f5e9; color: #2e7d32; }
    .status-failed { background: #fce4ec; color: #c62828; }
    .status-not_found { background: #fff3e0; color: #e65100; }
    .status-amended { background: #fff8e1; color: #f57f17; }
    .status-superseded { background: #f3e5f5; color: #7b1fa2; }

    /* Advisory */
    .advisory-item { padding: 8px 12px; border-radius: 5px; margin-bottom: 7px; font-size: 10pt; }
    .severity-critical { background: #fce4ec; border: 1px solid #ef9a9a; color: #b71c1c; }
    .severity-warning { background: #fff8e1; border: 1px solid #ffe082; color: #e65100; }
    .severity-info { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; }
    .flag-type { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px; opacity: 0.8; }
    .flag-reason { font-size: 8pt; opacity: 0.7; margin-top: 3px; }

    /* Attorney review */
    .attorney-note { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 5px; padding: 10px 14px; }
    .attorney-note p { font-size: 10pt; line-height: 1.6; }
    .review-meta { margin-top: 6px; font-size: 8pt; color: #2e7d32; }

    /* Jurisdiction */
    .jurisdiction-name { font-weight: 600; font-size: 11pt; color: #0e4f6e; margin-bottom: 3px; }
    .jurisdiction-code { font-size: 9pt; color: #555; font-family: monospace; }
    .jurisdiction-reason { font-size: 9pt; color: #777; margin-top: 3px; }

    /* Disclaimer */
    .disclaimer {
      background: #fff3e0;
      border: 1px solid #ffcc80;
      border-radius: 5px;
      padding: 10px 14px;
      margin-top: 22px;
      font-size: 9pt;
      color: #bf360c;
      line-height: 1.5;
    }

    /* Footer */
    .page-footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #e0e0e0;
      font-size: 8pt;
      color: #aaa;
      text-align: center;
    }

    .empty-state { color: #999; font-style: italic; font-size: 10pt; }
  </style>
</head>
<body>
  <div class="page">
    <!-- 1. HEADER -->
    <div class="report-header">
      <div class="brand-row">
        <div>
          <div class="brand-name">${t('الميزان للمحاماة', 'Al Mizan Legal Practice')}</div>
          <div class="brand-sub">CaseCraft / LegalWakeely — Attorney Review Platform</div>
        </div>
      </div>
      <div class="header-meta">
        <div><span class="label">ID</span><br>${input.investigationId}</div>
        <div><span class="label">${labels.generated}</span><br>${dateStr}</div>
        <div><span class="label">${labels.lang}</span><br>${isRTL ? 'العربية' : 'English'}</div>
        <div><span class="label">${labels.tier}</span><br>${pkg.tier}</div>
      </div>
      <div class="attorney-badge">${labels.attorneyPackage}</div>
      <div class="case-title">${investigationTitle}</div>
    </div>

    <!-- 2. PARTIES -->
    <div class="section">
      <div class="section-heading">${labels.parties}</div>
      <div class="parties-grid">
        <div class="party-card">
          <div class="party-label">${labels.claimant}</div>
          ${plaintiffs.map(p => `<div class="party-name">${p.name}</div>`).join('') || `<div class="party-name">—</div>`}
        </div>
        <div class="party-card">
          <div class="party-label">${labels.respondent}</div>
          ${defendants.map(p => `<div class="party-name">${p.name}</div>`).join('') || `<div class="party-name">—</div>`}
        </div>
      </div>
    </div>

    <!-- 3. JURISDICTION -->
    <div class="section">
      <div class="section-heading">${labels.jurisdiction}</div>
      ${courtHtml}
    </div>

    <!-- 4. CLAIM -->
    ${claimSection ? `
      <div class="section">
        <div class="section-heading">${labels.claim}</div>
        <div class="content-text">${claimSection.body}</div>
      </div>
    ` : ''}

    <!-- 5. RELIEF -->
    ${reliefSection ? `
      <div class="section">
        <div class="section-heading">${labels.relief}</div>
        <div class="content-text">${reliefSection.body}</div>
      </div>
    ` : ''}

    <!-- 6. TIMELINE -->
    <div class="section">
      <div class="section-heading">${labels.timeline}</div>
      ${datesHtml}
    </div>

    <!-- 7. KEY FACTS -->
    <div class="section">
      <div class="section-heading">${labels.facts}</div>
      ${factsHtml}
    </div>

    <!-- 8. CITATIONS -->
    <div class="section">
      <div class="section-heading">${labels.citations}</div>
      ${citationsHtml}
    </div>

    <!-- 9. ADVISORY FLAGS -->
    <div class="section">
      <div class="section-heading">${labels.advisory}</div>
      ${advisoryHtml}
    </div>

    <!-- 10. ATTORNEY REVIEW NOTE -->
    ${reviewHtml}

    <!-- DISCLAIMER -->
    <div class="disclaimer">
      <strong>${t('تنبيه هام:', 'IMPORTANT DISCLAIMER:')}</strong> ${labels.disclaimer}
    </div>

    <!-- FOOTER -->
    <div class="page-footer">
      ${t('الميزان للمحاماة', 'Al Mizan Legal Practice')} — CaseCraft &bull; ${t('تقرير مراجعة المحامي', 'Attorney Review Report')} &bull; ${dateStr}
    </div>
  </div>

  <script>
    // Wait for fonts to be ready before signaling completion
    document.fonts.ready.then(() => { document.__fontsReady = true; });
  </script>
</body>
</html>`;
}

/** Returns the ISO date string for the filename. */
export function getReportFilename(investigationId: string): string {
  const now = new Date();
  const isoDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return `CaseCraft-Report-${investigationId}-${isoDate}.pdf`;
}
