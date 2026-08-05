// =============================================================================
// Al Mizan — Document Automation API (Feature 2)
// =============================================================================
// GET  /api/generate-document?type=xxx  — List available templates
// POST /api/generate-document           — Generate a DOCX from a template
//
// Auth: Requires authenticated user with investigation-allowed role.
// Audit: Logs every document generation event.
// Multi-tenancy: Org-scoped on investigation lookup.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/org';
import { audit } from '@/lib/audit';
import { INVESTIGATION_ALLOWED_ROLES } from '@/lib/agents/types';
import {
  generateDocx,
  extractMergeFields,
  buildMergeFieldsFromPackage,
  type MergeFieldValues,
} from '@/lib/docx-generator';

// ── GET: List templates ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireRole([...INVESTIGATION_ALLOWED_ROLES]);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  const where: any = { isActive: true };
  if (type) where.type = type;

  const templates = await db.documentTemplate.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameAr: true,
      type: true,
      description: true,
      descriptionAr: true,
      language: true,
      category: true,
      content: true,
      isActive: true,
    },
  });

  const templatesWithFields = templates.map((t) => ({
    ...t,
    mergeFields: extractMergeFields(t.content),
  }));

  return NextResponse.json({ templates: templatesWithFields });
}

// ── POST: Generate DOCX ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireRole([...INVESTIGATION_ALLOWED_ROLES]);
  if (auth.ok === false) return auth.response;
  const { session } = auth;

  try {
    const body = await req.json();
    const { templateId, investigationId, lang = 'ar', customMergeValues = {} } = body;

    if (!templateId || !investigationId) {
      return NextResponse.json(
        { error: 'templateId and investigationId are required' },
        { status: 400 }
      );
    }

    const template = await db.documentTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Template not found or inactive' }, { status: 404 });
    }

    const investigation = await db.caseInvestigation.findFirst({
      where: {
        id: investigationId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      include: { assembly: true },
    });

    if (!investigation) {
      return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
    }

    if (!investigation.assembly?.packageJson) {
      return NextResponse.json(
        { error: 'Investigation has no assembled package. Generate a package first.' },
        { status: 422 }
      );
    }

    const pkg = JSON.parse(investigation.assembly.packageJson as string);
    const defaultValues = buildMergeFieldsFromPackage(pkg, lang as 'ar' | 'en');
    const mergeValues: MergeFieldValues = { ...defaultValues, ...customMergeValues };

    const docxBuffer = await generateDocx(template.content, mergeValues, {
      lang: lang as 'ar' | 'en',
      title: lang === 'ar' && template.nameAr ? template.nameAr : template.name,
      templateType: template.type,
    });

    const now = new Date();
    const isoDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const filename = `CaseCraft-${template.type}-${isoDate}.docx`;

    await audit(
      {
        action: 'document.generated',
        entity: 'DocumentTemplate',
        entityId: template.id,
        details: { templateType: template.type, investigationId, filename },
      },
      req
    );

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[generate-document] Error:', error);
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 });
  }
}
