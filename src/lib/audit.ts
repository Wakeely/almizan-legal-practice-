// =============================================================================
// Al Mizan — audit log writer (server-side, append-only)
// -----------------------------------------------------------------------------
// CRITICAL: This module is the ONLY way to write to AuditLog. There is no
// update/delete endpoint for audit entries. Reads are restricted to
// MANAGING Partner role within the same organization (tenant actions) or
// requirePlatformAdmin() (platform-wide read view).
//
// PRD v0.3 §6: AuditLog.organizationId is now NULLABLE. Platform-only actions
// (e.g. platform_admin.login, student_code.create, bootstrap) write a row with
// organizationId = null + actorType = 'platform_admin' + platformAdminId = <id>.
// Tenant actions still write organizationId = <real org id> + actorType =
// 'tenant_user'. The actorType discriminator prevents any ambiguity.
//
// Two entry points:
//   audit()          — for tenant-user actions (backward compatible with all
//                      existing callers). organizationId is still required for
//                      these — if neither the ctx nor the session provides one,
//                      the entry is skipped (same behavior as before).
//   platformAudit()  — for platform-admin actions. organizationId may be null
//                      (platform-only) or set (org-scoped admin action like
//                      suspend). platformAdminId is always required.
// =============================================================================

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export interface AuditInput {
  action: string;
  entity?: string;
  entityId?: string;
  matterId?: string;
  details?: Record<string, unknown>;
}

export interface AuditContext {
  // Explicit context — used for actions that occur outside a session
  // (e.g. self-registration). When omitted, the current session is used.
  userId?: string;
  organizationId?: string;
}

export async function audit(input: AuditInput, request?: Request, ctx?: AuditContext): Promise<void> {
  try {
    let userId: string | null = ctx?.userId ?? null;
    let organizationId: string | null = ctx?.organizationId ?? null;

    if (!userId || !organizationId) {
      const session = await getSessionUser();
      if (session) {
        userId = userId ?? session.id;
        organizationId = organizationId ?? session.organizationId;
      }
    }

    if (!organizationId) {
      // Truly anonymous action (e.g. reset-password for unknown email) — skip.
      // Tenant audit logs are org-scoped by design.
      return;
    }

    const ipAddress = request ? getClientIpSafe(request) : null;
    const userAgent = request?.headers.get("user-agent") ?? null;

    await db.auditLog.create({
      data: {
        organizationId,
        actorType: "tenant_user",
        userId,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        matterId: input.matterId ?? null,
        details: input.details ? JSON.stringify(input.details) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Audit log failures must never break the request flow, but should be logged
    console.error("[audit] failed to write audit log:", err);
  }
}

// ── Platform-admin audit writer (PRD v0.3 §6) ─────────────────────────────
// Used by /api/platform-admin/* routes. organizationId is NULLABLE — pass null
// for platform-only actions (login, student_code.create, bootstrap), or the
// affected org's id for org-scoped admin actions (suspend, password_reset,
// feature_flag_toggle).
export interface PlatformAuditInput {
  action: string;
  entity?: string;
  entityId?: string;
  organizationId?: string | null; // null = platform-only action
  platformAdminId: string;        // always required
  details?: Record<string, unknown>;
}

export async function platformAudit(
  input: PlatformAuditInput,
  request?: Request,
): Promise<void> {
  try {
    const ipAddress = request ? getClientIpSafe(request) : null;
    const userAgent = request?.headers.get("user-agent") ?? null;

    await db.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorType: "platform_admin",
        userId: null,
        platformAdminId: input.platformAdminId,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        matterId: null,
        details: input.details ? JSON.stringify(input.details) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[platformAudit] failed to write audit log:", err);
  }
}

function getClientIpSafe(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return null;
}

