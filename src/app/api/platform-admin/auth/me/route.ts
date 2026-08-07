// =============================================================================
// GET /api/platform-admin/auth/me
// -----------------------------------------------------------------------------
// Returns the current platform-admin session, or 401 if not authenticated.
// Used by the /platform-admin UI to decide whether to show the login form or
// the dashboard.
// =============================================================================

import { NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/platform-admin";

export async function GET() {
  const session = await getPlatformAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 },
    );
  }
  return NextResponse.json({ admin: session });
}
