// =============================================================================
// Al Mizan — PDF Case Report API (Feature 1)
// =============================================================================
// GET /api/case-report-pdf?investigationId=xxx
//
// Generates a professional, attorney-friendly PDF from the investigation
// package using Playwright (Chromium headless) for server-side HTML→PDF.
// Arabic fonts are embedded as base64 @font-face in the HTML template.
//
// Auth: Requires authenticated user with investigation-allowed role.
// Audit: Logs every PDF generation event.
// Multi-tenancy: Only returns PDFs for investigations in the user's org.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/org';
import { audit } from '@/lib/audit';
import { chromium } from 'playwright';
import { generatePdfHtml, getReportFilename, type PdfReportInput } from '@/lib/pdf-report-template';
import type { InvestigationPackage } from '@/lib/agents/types';
import { INVESTIGATION_ALLOWED_ROLES } from '@/lib/agents/types';

export async function GET(req: NextRequest) {
  // ── Auth gate ──────────────────────────────────────────────────────────
  const auth = await requireRole([...INVESTIGATION_ALLOWED_ROLES]);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  // ── Input validation ───────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const investigationId = searchParams.get('investigationId');
  if (!investigationId) {
    return NextResponse.json({ error: 'investigationId is required' }, { status: 400 });
  }

  // ── Fetch investigation (org-scoped) ───────────────────────────────────
  const investigation = await db.caseInvestigation.findFirst({
    where: {
      id: investigationId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    include: {
      intake: true,
      research: true,
      courtRouting: true,
      draft: true,
      citationVerifications: true,
      factChecks: true,
      assembly: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { reviewer: { select: { name: true } } },
      },
    },
  });

  if (!investigation) {
    return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
  }

  // ── Require assembled package ──────────────────────────────────────────
  if (!investigation.assembly?.packageJson) {
    return NextResponse.json(
      { error: 'Investigation has no assembled package yet. PDF can only be generated after assembly.' },
      { status: 422 }
    );
  }

  // ── Parse the InvestigationPackage from JSON ───────────────────────────
  const pkg: InvestigationPackage = JSON.parse(investigation.assembly.packageJson as string);
  const lang = (investigation.lang || 'ar') as 'ar' | 'en';

  // ── Build attorney review info ─────────────────────────────────────────
  const latestReview = investigation.reviews[0];
  const attorneyReview = latestReview
    ? {
        decision: latestReview.decision,
        note: latestReview.note || undefined,
        reviewedAt: new Date(latestReview.createdAt).toLocaleDateString(
          lang === 'ar' ? 'ar-JO' : 'en-GB',
          { year: 'numeric', month: 'long', day: 'numeric' }
        ),
        reviewerName: latestReview.reviewer.name || undefined,
      }
    : null;

  // ── Generate HTML ──────────────────────────────────────────────────────
  const html = generatePdfHtml({
    investigationId: investigation.id,
    package: pkg,
    investigationTitle: investigation.title,
    lang,
    attorneyReview,
  });

  // ── Playwright PDF generation ──────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Wait for embedded fonts to be ready (critical for Arabic shaping)
      await page.waitForFunction('document.__fontsReady === true', { timeout: 15000 }).catch(() => {
        console.warn('[case-report-pdf] Font ready signal timeout, proceeding anyway');
      });
      await page.waitForTimeout(500); // Extra settling time for font rendering

      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '15mm', left: '12mm', right: '12mm' },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[case-report-pdf] Playwright error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  // ── Audit log ──────────────────────────────────────────────────────────
  await audit(
    {
      action: 'investigation.pdf_generated',
      entity: 'CaseInvestigation',
      entityId: investigation.id,
      details: { lang, filename: getReportFilename(investigation.id) },
    },
    req
  );

  // ── Return PDF ─────────────────────────────────────────────────────────
  const filename = getReportFilename(investigation.id);
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  });
}
