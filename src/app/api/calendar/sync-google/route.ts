// =============================================================================
// POST /api/calendar/sync-google — STUB
// -----------------------------------------------------------------------------
// The reference CalendarModule calls this to push events to Google Calendar.
// Real implementation requires:
//   1. Google OAuth credentials (Google Cloud project + consent screen)
//   2. Server-side OAuth flow to obtain a refresh token per user
//   3. Google Calendar API client
// This is documented as a CURRENT LIMITATION — see README.
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  await audit({ action: "calendar.google-sync.attempted" }, req);

  return NextResponse.json({
    ok: false,
    synced: 0,
    message: "Google Calendar sync is not yet implemented. See README → Current Limitations.",
  });
}
