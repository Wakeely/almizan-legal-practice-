// =============================================================================
// GET  /api/platform-admin/organizations/[id] — full org detail
// PATCH /api/platform-admin/organizations/[id] — suspend / restore / toggle addon
// -----------------------------------------------------------------------------
// PRD v0.3 §6: org-scoped admin actions (suspend, restore, feature_flag_toggle)
// write a platform_admin.* audit entry with organizationId = <the affected org>.
// This is NOT a fake tenant — it's the real org being acted upon.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          matters: { where: { deletedAt: null } },
          documents: true,
          auditLogs: true,
        },
      },
    },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      barAssociationId: org.barAssociationId,
      jurisdiction: org.jurisdiction,
      status: org.status,
      investigationAgentEnabled: org.investigationAgentEnabled,
      aiKeyProvider: org.aiKeyProvider,
      aiKeyConfigured:
        !!(org as any).aiKeyOpenaiEncrypted ||
        !!(org as any).aiKeyXaiEncrypted ||
        !!(org as any).aiKeyGeminiEncrypted,
      aiKeyUpdatedAt: (org as any).aiKeyUpdatedAt?.toISOString() ?? null,
      aiKeyLastVerifiedAt: (org as any).aiKeyLastVerifiedAt?.toISOString() ?? null,
      suspendedAt: org.suspendedAt?.toISOString() ?? null,
      suspendedReason: org.suspendedReason,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      counts: {
        users: org._count.users,
        matters: org._count.matters,
        documents: org._count.documents,
        auditLogs: org._count.auditLogs,
      },
    },
  });
}

const patchSchema = z.object({
  status: z.enum(["active", "suspended", "archived"]).optional(),
  suspendReason: z.string().max(500).optional(),
  investigationAgentEnabled: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const body = await req.json().catch((): null => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { status, suspendReason, investigationAgentEnabled } = parsed.data;

  const org = await db.organization.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, investigationAgentEnabled: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  // ── Suspend / restore ──────────────────────────────────────────────────
  if (status && status !== org.status) {
    if (status === "suspended") {
      // Require a reason for suspension
      if (!suspendReason || !suspendReason.trim()) {
        return NextResponse.json(
          { error: "A reason is required to suspend an organization." },
          { status: 400 },
        );
      }
      await db.organization.update({
        where: { id },
        data: {
          status: "suspended",
          suspendedAt: new Date(),
          suspendedReason: suspendReason.trim(),
        },
      });
      await platformAudit(
        {
          action: "platform_admin.org_suspend",
          entity: "organization",
          entityId: id,
          organizationId: id, // real affected org (PRD v0.3 §6)
          platformAdminId: r.session.adminId,
          details: {
            orgName: org.name,
            reason: suspendReason.trim(),
            priorStatus: org.status,
          },
        },
        req,
      );
    } else {
      // Restore / archive
      await db.organization.update({
        where: { id },
        data: {
          status,
          suspendedAt: status === "active" ? null : undefined,
          suspendedReason: status === "active" ? null : undefined,
        },
      });
      await platformAudit(
        {
          action: "platform_admin.org_status_change",
          entity: "organization",
          entityId: id,
          organizationId: id,
          platformAdminId: r.session.adminId,
          details: { orgName: org.name, priorStatus: org.status, newStatus: status },
        },
        req,
      );
    }
  }

  // ── Toggle investigation add-on ────────────────────────────────────────
  if (typeof investigationAgentEnabled === "boolean" && investigationAgentEnabled !== org.investigationAgentEnabled) {
    await db.organization.update({
      where: { id },
      data: { investigationAgentEnabled },
    });
    await platformAudit(
      {
        action: "platform_admin.feature_flag_toggle",
        entity: "organization",
        entityId: id,
        organizationId: id,
        platformAdminId: r.session.adminId,
        details: {
          orgName: org.name,
          flag: "investigationAgentEnabled",
          value: investigationAgentEnabled,
        },
      },
      req,
    );
  }

  return NextResponse.json({ ok: true });
}
