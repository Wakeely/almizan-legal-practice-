// =============================================================================
// GET  /api/invitations/accept?token=... — validate token, return invitation details
// POST /api/invitations/accept — create the User, mark invitation accepted, log in
// -----------------------------------------------------------------------------
// PRD v0.6 §5.2, §6:
// - Public (no auth required for GET; POST creates the session).
// - Token is looked up by hash; status must be 'pending'; expiry must be in the future.
// - The accepter CANNOT choose their own org, role, or matter — all three are
//   fixed by the invitation record, not client input.
// - For client invites, primaryMatterId is set on the created User.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/email";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

// ── GET: validate token + return details for display ───────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: {
      organization: {
        select: { id: true, name: true, jurisdiction: true },
      },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation token." }, { status: 404 });
  }

  if (invitation.status === "accepted") {
    return NextResponse.json({ error: "This invitation has already been accepted.", status: "accepted" }, { status: 410 });
  }
  if (invitation.status === "revoked") {
    return NextResponse.json({ error: "This invitation has been revoked.", status: "revoked" }, { status: 410 });
  }
  if (invitation.expiresAt < new Date()) {
    // Mark as expired in the DB so the list view reflects it
    await db.invitation.update({ where: { id: invitation.id }, data: { status: "expired" } }).catch(() => {});
    return NextResponse.json({ error: "This invitation has expired.", status: "expired" }, { status: 410 });
  }

  // Load the matter title if this is a client invite
  let matterTitle: string | null = null;
  if (invitation.matterId) {
    const matter = await db.matter.findUnique({
      where: { id: invitation.matterId },
      select: { title: true },
    });
    matterTitle = matter?.title ?? null;
  }

  // Check if the email is already registered
  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, organizationId: true, primaryMatterId: true },
  });

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      matterId: invitation.matterId,
      matterTitle,
      organizationName: invitation.organization.name,
      organizationId: invitation.organization.id,
      expiresAt: invitation.expiresAt.toISOString(),
    },
    alreadyRegistered: !!existingUser,
    // If already registered with a DIFFERENT org, the accepter must be told
    // they'll be moved to the inviting org. If same org + same matter, they
    // may already have access.
    existingOrgId: existingUser?.organizationId ?? null,
  });
}

// ── POST: create user + mark accepted + log in ─────────────────────────────
const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2, "Name is too short").max(120),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { token, name, password } = parsed.data;

  // Validate password strength
  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason ?? "Password does not meet strength requirements." }, { status: 400 });
  }

  // Look up the invitation by token hash
  const tokenHash = hashToken(token);
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation token." }, { status: 404 });
  }
  if (invitation.status !== "pending") {
    return NextResponse.json({ error: `This invitation is ${invitation.status}.` }, { status: 410 });
  }
  if (invitation.expiresAt < new Date()) {
    await db.invitation.update({ where: { id: invitation.id }, data: { status: "expired" } }).catch(() => {});
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  // Check if the email is already registered
  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, organizationId: true },
  });

  const passwordHash = await hashPassword(password);

  if (existingUser) {
    // The email is already registered — move the user to the inviting org
    // with the invited role. This handles the case where someone was a MP of
    // their own empty firm and is now joining a real firm.
    await db.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        passwordHash,
        organizationId: invitation.organizationId,
        role: invitation.role,
        primaryMatterId: invitation.matterId,
        // Clear any prior org-specific state
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create a new user inside the inviting org
    await db.user.create({
      data: {
        email: invitation.email,
        name,
        passwordHash,
        organizationId: invitation.organizationId,
        role: invitation.role,
        primaryMatterId: invitation.matterId,
        accountType: invitation.role === "Client Representative" ? "Client" : "Law Firm",
        subscriptionTier: "Free Trial",
        planStatus: "Active",
        trialDaysLeft: 0,
        seats: 1,
        maxSeats: 10,
        billingCycle: "Monthly",
        // Email is considered verified — they clicked a signed token to get here
        emailVerified: new Date(),
      },
    });
  }

  // Mark the invitation as accepted
  await db.invitation.update({
    where: { id: invitation.id },
    data: { status: "accepted", acceptedAt: new Date() },
  });

  // Audit log
  await audit(
    {
      action: "invitation.accept",
      entity: "invitation",
      entityId: invitation.id,
      matterId: invitation.matterId,
      details: {
        email: invitation.email,
        role: invitation.role,
        orgName: invitation.organization.name,
        matterId: invitation.matterId,
      },
    },
    req,
    { organizationId: invitation.organizationId },
  );

  // Sign in the user via NextAuth credentials flow (server-side)
  // The client will call signIn("credentials", ...) after this returns ok.
  // We can't call signIn directly from a route handler (it's a client function),
  // so we return ok and let the client perform the signIn.
  return NextResponse.json({
    ok: true,
    email: invitation.email,
    redirectTo: invitation.role === "Client Representative" && invitation.matterId
      ? `/client-portal/matters/${invitation.matterId}`
      : "/workspace",
  });
}
