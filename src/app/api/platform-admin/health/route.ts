// =============================================================================
// GET /api/platform-admin/health
// -----------------------------------------------------------------------------
// Platform health: DB connectivity, kill-switch states, AI provider config
// status, bootstrap state. Read-only. Gated by requirePlatformAdmin().
// PRD v0.3 §9: surfaces bootstrap state so the admin knows whether the
// one-shot endpoint is still live.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin, getBootstrapState } from "@/lib/platform-admin";

export async function GET() {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  // DB connectivity — a simple count query. If it throws, we report disconnected.
  let dbConnected = true;
  try {
    await db.organization.count();
  } catch {
    dbConnected = false;
  }

  const bootstrap = await getBootstrapState();

  // Kill-switch states — read-only reflection of env vars. The admin cannot
  // toggle these from the dashboard (they require a Vercel redeploy). This
  // view exists so the admin doesn't have to check Vercel to know if a
  // dangerous endpoint is live (PRD v0.3 §9 / PRD §5.9).
  const killSwitches = [
    { envVar: "ADMIN_BOOTSTRAP_ENABLED", enabled: process.env.ADMIN_BOOTSTRAP_ENABLED === "1" },
    { envVar: "PLATFORM_ADMIN_BOOTSTRAP_ENABLED", enabled: bootstrap.enabled },
    { envVar: "PASSWORD_RESET_ENABLED", enabled: process.env.PASSWORD_RESET_ENABLED === "1" },
    { envVar: "INVESTIGATION_ADDON_ENABLED", enabled: process.env.INVESTIGATION_ADDON_ENABLED === "1" },
  ];

  // AI provider configuration — whether the platform-level key is set.
  // Per-org BYOK keys are NOT surfaced here (see Organizations view for that).
  const aiProviders = [
    {
      provider: "gemini",
      configured: !!process.env.GEMINI_API_KEY,
    },
    {
      provider: "openai",
      configured: !!process.env.OPENAI_API_KEY,
    },
    {
      provider: "groq",
      configured: !!process.env.GROQ_API_KEY,
    },
  ];

  return NextResponse.json({
    dbConnected,
    bootstrap: {
      ...bootstrap,
      message: bootstrap.firstAdminExists
        ? "First PlatformAdmin exists. Bootstrap endpoint must refuse to run even if re-enabled."
        : bootstrap.enabled
          ? "Bootstrap is ENABLED and no admin exists yet. POST to /api/platform-admin/auth/bootstrap to create the first admin."
          : "Bootstrap is DISABLED. Set PLATFORM_ADMIN_BOOTSTRAP_ENABLED=1 + PLATFORM_ADMIN_BOOTSTRAP_TOKEN to enable.",
    },
    killSwitches,
    aiProviders,
  });
}
