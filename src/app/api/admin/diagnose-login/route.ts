// =============================================================================
// POST /api/admin/diagnose-login — safe login diagnostics (no hash exposure)
// -----------------------------------------------------------------------------
// WHY THIS EXISTS:
//   Password reset succeeded (returned ok:true) but login still fails with
//   "Invalid credentials". NextAuth's authorize() returns null on ANY failure
//   with no diagnostic info, so we can't tell from the outside whether it's:
//     - wrong password (bcrypt mismatch)
//     - user not found
//     - user found but organization relation is null (org deleted, or Prisma
//       client/DB schema mismatch — e.g. investigationAgentEnabled column
//       missing from the DB but expected by the client)
//     - the organization row itself failing to load
//
// This endpoint runs the SAME checks NextAuth runs, but returns a detailed
// breakdown of which step failed — WITHOUT exposing the password hash.
//
// SECURITY:
//   - Same kill-switch as the password reset endpoint: PASSWORD_RESET_ENABLED=1
//     + PASSWORD_RESET_TOKEN must be supplied in the body.
//   - Rate-limited per IP.
//   - Audit-logged.
//   - NEVER returns passwordHash, password, or token in any response.
//   - Only returns boolean / structural info (user exists, org exists,
//     password verifies, columns present).
//
// HOW TO USE:
//   POST /api/admin/diagnose-login
//   Body: { email: "user@example.com", password: "their-password", token: "..." }
//   Returns: { steps: [...], canLogin: true/false, blocker: "..." }
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

const diagnoseSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  token: z.string().min(8, "Token is required"),
});

interface DiagStep {
  step: string;
  ok: boolean;
  message: string;
}

export async function POST(req: Request) {
  // ── Kill-switch ────────────────────────────────────────────────────────
  if (process.env.PASSWORD_RESET_ENABLED !== "1") {
    return NextResponse.json(
      { error: "Diagnostic endpoint is disabled. Set PASSWORD_RESET_ENABLED=1 + redeploy." },
      { status: 403 },
    );
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  const body = await req.json().catch((): null => null);
  const parsed = diagnoseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request. Required: email, password, token." },
      { status: 400 },
    );
  }
  const { email, password, token } = parsed.data;

  // ── Token check (same as reset endpoint) ───────────────────────────────
  const expectedToken = process.env.PASSWORD_RESET_TOKEN;
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json(
      { error: "Invalid token." },
      { status: 401 },
    );
  }

  const steps: DiagStep[] = [];
  const emailLower = email.toLowerCase();

  // ── Step 1: Does the user row exist? ───────────────────────────────────
  let user: any = null;
  try {
    user = await db.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        passwordHash: true, // needed for step 4 — NOT returned in response
        deletedAt: true,
      },
    });
    if (!user) {
      steps.push({
        step: "user_lookup",
        ok: false,
        message: `No user found with email "${emailLower}". This is the blocker — the email doesn't match any row in the User table.`,
      });
      return finish(steps, false, "user_not_found", req, emailLower);
    }
    steps.push({
      step: "user_lookup",
      ok: true,
      message: `User found: id=${user.id}, email=${user.email}, role=${user.role}, organizationId=${user.organizationId}`,
    });
  } catch (err: any) {
    steps.push({
      step: "user_lookup",
      ok: false,
      message: `DB error looking up user: ${err?.message ?? String(err)}`,
    });
    return finish(steps, false, "db_error", req, emailLower);
  }

  // ── Step 2: Is the user soft-deleted? (prod schema has deletedAt) ──────
  if (user.deletedAt) {
    steps.push({
      step: "user_deleted",
      ok: false,
      message: `User is soft-deleted (deletedAt=${user.deletedAt.toISOString()}). Login is blocked.`,
    });
    return finish(steps, false, "user_deleted", req, emailLower);
  }
  steps.push({
    step: "user_deleted",
    ok: true,
    message: "User is not soft-deleted.",
  });

  // ── Step 3: Does the organization relation load? ───────────────────────
  // This is the critical check. NextAuth's authorize() does
  //   include: { organization: true }
  // and then checks `if (!user || !user.organization) return null`.
  // If the org relation fails to load (e.g. because the Prisma client expects
  // a column the DB doesn't have, like investigationAgentEnabled), login
  // fails with a generic "Invalid credentials" — NO error is surfaced.
  let org: any = null;
  try {
    // Use the SAME include pattern as NextAuth.
    const userWithOrg = await db.user.findUnique({
      where: { email: emailLower },
      include: { organization: true },
    });
    org = userWithOrg?.organization ?? null;
    if (!org) {
      steps.push({
        step: "organization_load",
        ok: false,
        message: `User exists (organizationId=${user.organizationId}) but the organization relation returned null. This means the Organization row is missing OR the Prisma client can't load it (likely a schema mismatch — e.g. the DB is missing the investigationAgentEnabled column that the deployed Prisma client expects). Run /api/admin/push-investigation-schema to add the missing column, then retry login.`,
      });
      return finish(steps, false, "organization_missing", req, emailLower);
    }
    steps.push({
      step: "organization_load",
      ok: true,
      message: `Organization loaded: id=${org.id}, name="${org.name}", slug="${org.slug}"`,
    });
  } catch (err: any) {
    steps.push({
      step: "organization_load",
      ok: false,
      message: `DB error loading organization relation: ${err?.message ?? String(err)}. This is likely a Prisma client / DB schema mismatch — the deployed client expects a column the DB doesn't have (e.g. investigationAgentEnabled). Run /api/admin/push-investigation-schema to add the missing column.`,
    });
    return finish(steps, false, "org_load_error", req, emailLower);
  }

  // ── Step 4: Does the password verify? ──────────────────────────────────
  try {
    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      steps.push({
        step: "password_verify",
        ok: false,
        message: "Password does NOT match the stored hash. Either the wrong password was typed, or the reset didn't persist. Try resetting again via /api/admin/reset-user-password.",
      });
      return finish(steps, false, "password_mismatch", req, emailLower);
    }
    steps.push({
      step: "password_verify",
      ok: true,
      message: "Password matches the stored hash. bcrypt verification passed.",
    });
  } catch (err: any) {
    steps.push({
      step: "password_verify",
      ok: false,
      message: `Error during bcrypt verify: ${err?.message ?? String(err)}`,
    });
    return finish(steps, false, "bcrypt_error", req, emailLower);
  }

  // ── Step 5: Does the Organization table have the investigationAgentEnabled column?
  // This is a bonus check — if missing, it confirms the schema-mismatch theory
  // AND tells us the push-investigation-schema endpoint hasn't been run yet. ──
  try {
    const colCheck = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Organization' AND column_name = 'investigationAgentEnabled'
      LIMIT 1
    `);
    const hasCol = Array.isArray(colCheck) && colCheck.length > 0;
    steps.push({
      step: "org_schema_check",
      ok: hasCol,
      message: hasCol
        ? "Organization.investigationAgentEnabled column exists in DB."
        : "Organization.investigationAgentEnabled column is MISSING from DB. The deployed Prisma client expects it (it was added in commit 7c7e399). This schema mismatch is the most likely cause of login failure — NextAuth loads the org, Prisma tries to SELECT the missing column, the query throws, and the org relation comes back null.",
    });
  } catch (err: any) {
    steps.push({
      step: "org_schema_check",
      ok: false,
      message: `Could not check schema: ${err?.message ?? String(err)}`,
    });
  }

  // ── All checks passed ──────────────────────────────────────────────────
  return finish(steps, true, null, req, emailLower);
}

// ── Helper: write audit log + return the response ─────────────────────────
async function finish(
  steps: DiagStep[],
  canLogin: boolean,
  blocker: string | null,
  req: Request,
  email: string,
) {
  await audit(
    {
      action: "admin.diagnose_login",
      entity: "user",
      details: {
        email,
        canLogin,
        blocker,
        stepCount: steps.length,
        passedSteps: steps.filter((s) => s.ok).length,
      },
    },
    req,
  );

  return NextResponse.json({
    canLogin,
    blocker,
    steps,
    nextAction: canLogin
      ? "All checks passed. Login should work. If it still fails, the issue is browser-side (cache, cookies, autofill). Try an incognito window."
      : blocker === "organization_missing" || blocker === "org_load_error"
        ? "Run POST /api/admin/push-investigation-schema to add the missing investigationAgentEnabled column to the Organization table. This will fix the schema mismatch and login should work."
        : blocker === "password_mismatch"
          ? "Reset the password again via POST /api/admin/reset-user-password, then retry login. Double-check you're typing the same password you sent."
          : blocker === "user_not_found"
            ? "The email doesn't match any user row. Check for typos. The user may have registered with a different email."
            : "See the steps array for details.",
  });
}

// GET — status check
export async function GET() {
  return NextResponse.json({
    enabled: process.env.PASSWORD_RESET_ENABLED === "1",
    message: "POST with { email, password, token } to run diagnostics.",
  });
}
