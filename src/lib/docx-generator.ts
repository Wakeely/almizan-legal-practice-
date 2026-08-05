// =============================================================================
// Al Mizan — Legal Document Automation — DOCX generator (Feature 2)
// =============================================================================
// Template-driven legal document generation with merge fields.
// Full bilingual + RTL support for Arabic templates.
// Primary output: editable .docx (via the 'docx' library).
// =============================================================================

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  Packer,
} from 'docx';
import type { InvestigationPackage } from '@/lib/agents/types';

// ---------------------------------------------------------------------------
// Merge field types and helpers
// ---------------------------------------------------------------------------

export interface MergeFieldValues {
  [key: string]: string;
}

/** Extract merge field names from template content ({{fieldName}} syntax) */
export function extractMergeFields(templateContent: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const fields: Set<string> = new Set();
  let match;
  while ((match = regex.exec(templateContent)) !== null) {
    fields.add(match[1]);
  }
  return Array.from(fields);
}

/** Build default merge field values from an InvestigationPackage */
export function buildMergeFieldsFromPackage(
  pkg: InvestigationPackage,
  lang: 'ar' | 'en'
): MergeFieldValues {
  const isAr = lang === 'ar';

  const plaintiffs = pkg.intake.parties.filter(p => p.role === 'plaintiff' || p.role === 'claimant');
  const defendants = pkg.intake.parties.filter(p => p.role === 'defendant' || p.role === 'respondent');

  return {
    claimantName: plaintiffs.map(p => p.name).join(', ') || (isAr ? 'المدعي' : 'Claimant'),
    respondentName: defendants.map(p => p.name).join(', ') || (isAr ? 'المدعى عليه' : 'Respondent'),
    caseTitle: pkg.title,
    courtName: isAr && pkg.courtRouting.courtNameAr
      ? pkg.courtRouting.courtNameAr
      : pkg.courtRouting.courtNameEn || '',
    courtCode: pkg.courtRouting.courtCode || '',
    currentDate: new Date().toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    }),
    verificationTier: pkg.tier,
    intakeSummary: pkg.intake.summary,
    // Placeholder fields for attorney to fill in
    agreementDate: isAr ? '[تاريخ الاتفاقية]' : '[Agreement Date]',
    breachDate: isAr ? '[تاريخ المخالفة]' : '[Breach Date]',
    filingDate: isAr ? '[تاريخ الإيداع]' : '[Filing Date]',
    damagesAmount: isAr ? '[مبلغ التعويضات]' : '[Damages Amount]',
    respondentObligation: isAr ? '[التزام المدعى عليه]' : '[Respondent Obligation]',
    recipientName: defendants.map(p => p.name).join(', ') || '',
    recipientAddress: isAr ? '[عنوان المستلم]' : '[Recipient Address]',
    subjectLine: pkg.title,
    responseDeadline: '14',
    defenseParagraph1: isAr ? '[فقرة الدفاع الأولى]' : '[First defense paragraph]',
    defenseParagraph2: isAr ? '[فقرة الدفاع الثانية]' : '[Second defense paragraph]',
    defenseParagraph3: isAr ? '[فقرة الدفاع الثالثة]' : '[Third defense paragraph]',
    motionGround1: isAr ? '[أساس الطلب الأول]' : '[First ground for motion]',
    motionGround2: isAr ? '[أساس الطلب الثاني]' : '[Second ground for motion]',
    legalBasis: isAr ? '[الأساس القانوني]' : '[Legal basis]',
    noticeBody: isAr ? '[نص الإشعار]' : '[Notice body text]',
  };
}

/** Apply merge field values to a template content string */
export function applyMergeFields(
  templateContent: string,
  values: MergeFieldValues
): string {
  let result = templateContent;
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || `[${key}]`);
  }
  // Replace any remaining unresolved merge fields with placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, '[$1]');
  return result;
}

// ---------------------------------------------------------------------------
// DOCX generation
// ---------------------------------------------------------------------------

/**
 * Generate a DOCX document from template content with merge fields applied.
 */
export async function generateDocx(
  templateContent: string,
  mergeValues: MergeFieldValues,
  options: {
    lang: 'ar' | 'en';
    title: string;
    templateType: string;
  }
): Promise<Buffer> {
  const isRTL = options.lang === 'ar';
  const appliedContent = applyMergeFields(templateContent, mergeValues);

  // Split content into paragraphs
  const lines = appliedContent.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // Detect headings (ALL CAPS or specific section headers)
    const isHeading = /^[A-Z\s\u0600-\u06FF\s]{5,}$/.test(trimmed) ||
      trimmed.startsWith('IN THE') ||
      ['STATEMENT OF CLAIM', 'STATEMENT OF DEFENSE', 'MOTION FOR SUMMARY JUDGMENT',
        'RELIEF SOUGHT', 'RELIEF', 'RELIEF REQUESTED', 'BETWEEN:', 'TO THE HONORABLE COURT:',
        'بيان الدعوى', 'بيان الدفاع', 'الطلبات المطلوبة'].includes(trimmed) ||
      trimmed.startsWith('RE:') || trimmed.startsWith('في محكمة');

    // Detect separator lines
    const isSeparator = /^_{3,}$/.test(trimmed) || /^={3,}$/.test(trimmed);

    // Detect numbered paragraphs (e.g., "1.", "2.")
    const isNumbered = /^\d+\.\s/.test(trimmed);

    // Detect party labels
    const isPartyLabel = ['Claimant', 'Respondent', 'المدعي', 'المدعى عليه',
      'Claimant/Applicant', 'المستلم'].includes(trimmed);

    if (isSeparator) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    if (isHeading) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 28,
              font: isRTL ? 'Noto Sans Arabic' : 'Georgia',
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 200, after: 100 },
        })
      );
      continue;
    }

    if (isPartyLabel) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              italics: true,
              size: 24,
              font: isRTL ? 'Noto Sans Arabic' : 'Georgia',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 50 },
        })
      );
      continue;
    }

    if (trimmed === '- and -' || trimmed === '— و —') {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              size: 24,
              font: isRTL ? 'Noto Sans Arabic' : 'Georgia',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 50, after: 50 },
        })
      );
      continue;
    }

    // Regular paragraph (numbered, sub-item, or normal)
    const isSubItem = /^\([a-z]\)/.test(trimmed);
    const isBoldStart = trimmed.startsWith('Dated:') || trimmed.startsWith('التاريخ:');

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: trimmed,
            bold: isBoldStart,
            size: 22,
            font: isRTL ? 'Noto Naskh Arabic' : 'Georgia',
          }),
        ],
        alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { before: 80, after: 80 },
        indent: isNumbered || isSubItem ? { left: 720 } : undefined,
      })
    );
  }

  // Draft disclaimer
  paragraphs.push(new Paragraph({ text: '' }));
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: isRTL
            ? 'تنبيه: مسودة — يجب مراجعتها من قبل المحامي قبل الإيداع.'
            : 'DISCLAIMER: DRAFT — Must be reviewed by counsel before filing.',
          bold: true,
          size: 20,
          color: 'CC0000',
          font: isRTL ? 'Noto Sans Arabic' : 'Georgia',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CC0000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CC0000' },
      },
    })
  );

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: isRTL ? 'الميزان للمحاماة — CaseCraft' : 'Al Mizan Legal Practice — CaseCraft',
                  size: 16,
                  color: '888888',
                  font: isRTL ? 'Noto Sans Arabic' : 'Georgia',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: isRTL ? 'مسودة — يجب مراجعتها من قبل المحامي | صفحة ' : 'DRAFT — Must be reviewed by counsel | Page ',
                  size: 16,
                  color: 'CC0000',
                  font: isRTL ? 'Noto Sans Arabic' : 'Georgia',
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 16,
                  color: '888888',
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: paragraphs,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
