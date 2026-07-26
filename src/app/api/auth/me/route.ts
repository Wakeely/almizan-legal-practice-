// GET /api/auth/me — returns the full user profile for the current session.

import { NextResponse } from "next/server";
import { getFullUserProfile } from "@/lib/session";

export async function GET() {
  const user = await getFullUserProfile();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
