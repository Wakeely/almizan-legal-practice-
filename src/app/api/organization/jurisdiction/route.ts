// =============================================================================
// /api/organization/jurisdiction
// -----------------------------------------------------------------------------
//   GET  → current org jurisdiction (canonical code + bilingual info + the
//          raw legacy value still stored on the row, if any)
//   PUT  → update the org's default jurisdiction (Managing Partner only).
//          Accepts either a canonical code ("JO", "AE", ...) or one of the
//          legacy dropdown labels — both are normalized via the catalog so
//          existing client code keeps working.
//
// SECURITY:
//   - Every call requires an authenticated session scoped to the org.
//   - PUT requires the Managing Partner role (matches the existing pattern in
//     /api/auth/register, where the first user is created as Managing Partner).
//   - The org's jurisdiction is org-wide configuration, NOT user-private data,
//     so any member can read it (so they can render the right default on the
//     matter intake form). Only the managing partner can change it.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { audit } from "@/lib/audit";
import { parseBody } from "@/lib/validation/auth";
import {
  JURISDICTIONS,
  JURISDICTION_LIST,
  normalizeJurisdiction,
  resolveOrgJurisdiction,
  type JurisdictionCode,
} from "@/lib/jurisdictions";

// Allowed canonical codes for the PUT body.
const ALLOWED_CODES = Object.keys(JURISDICTIONS) as JurisdictionCode[];

const putSchema = z.object({
  // Accept canonical codes (preferred) OR legacy labels (mapped via catalog).
  // This keeps backward compatibility with any client that still posts the
  // old "Jordan Courts & Arbitration" string.
  jurisdiction: z.string().min(2).max(120),
});

// -----------------------------------------------------------------------------
// GET — current jurisdiction + the full catalog (so the UI can render the
// picker without a separate round-trip)
// -----------------------------------------------------------------------------

export async function GET() {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const org = await db.organization.findUnique({
    where: { id: r.session.organizationId },
    select: { id: true, name: true, jurisdiction: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const info = resolveOrgJurisdiction(org);
  const isCanonical = (ALLOWED_CODES as string[]).includes(org.jurisdiction);

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      // The raw stored value (might be a legacy label pre-migration).
      rawJurisdiction: org.jurisdiction,
      // The canonical code we resolve to.
      jurisdictionCode: info.code,
      // Whether the stored value was already canonical (no migration needed).
      isCanonical,
    },
    // The resolved JurisdictionInfo (bilingual labels + legal context).
    current: info,
    // The full catalog, for the dropdown.
    catalog: JURISDICTION_LIST,
  });
}

// -----------------------------------------------------------------------------
// PUT — update org default jurisdiction (Managing Partner only)
// -----------------------------------------------------------------------------

export async function PUT(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  // Role gate — same role convention as the rest of the app.
  if (r.session.role !== "Managing Partner") {
    return NextResponse.json(
      { error: "Only the Managing Partner can change the firm's default jurisdiction." },
      { status: 403 },
    );
  }

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(putSchema, body);
  if (parsed.ok === false) {
    return NextResponse.json({ error: parsed.error, fieldErrors: (parsed as any).fieldErrors }, { status: 400 });
  }

  const code = normalizeJurisdiction(parsed.data.jurisdiction);
  // Persist the canonical CODE (e.g. "JO", "AE"). This is what new code reads
  // going forward. normalizeJurisdiction already maps legacy labels to codes.
  const org = await db.organization.update({
    where: { id: r.session.organizationId },
    data: { jurisdiction: code },
    select: { id: true, name: true, jurisdiction: true },
  });

  await audit(
    {
      action: "org.jurisdiction.updated",
      entity: "organization",
      entityId: org.id,
      details: { jurisdiction: code, label: JURISDICTIONS[code].labelBilingual },
    },
    req,
  );

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      rawJurisdiction: org.jurisdiction,
      jurisdictionCode: code,
      isCanonical: true,
    },
    current: JURISDICTIONS[code],
  });
}
