// =============================================================================
// Al Mizan — audit log writer (server-side, append-only)
// -----------------------------------------------------------------------------
// CRITICAL: This module is the ONLY way to write to AuditLog. There is no
// update/delete endpoint for audit entries. Reads are restricted to
// MANAGING Partner role within the same organization.
//
// Audit calls default to using the current session. For actions that occur
// OUTSIDE a session (e.g. self-registration, password-reset request), pass an
// explicit `userId` + `organizationId` override via the optional second arg.
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
      // Audit logs are org-scoped by design.
      return;
    }

    const ipAddress = request ? getClientIpSafe(request) : null;
    const userAgent = request?.headers.get("user-agent") ?? null;

    await db.auditLog.create({
      data: {
        organizationId,
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

function getClientIpSafe(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return null;
}

