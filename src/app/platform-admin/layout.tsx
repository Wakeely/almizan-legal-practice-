// =============================================================================
// /platform-admin/layout.tsx
// -----------------------------------------------------------------------------
// Minimal layout for the Super Admin dashboard. Intentionally does NOT share
// chrome with /workspace/* — the platform admin surface is a distinct app.
// PRD v0.3 §1: UI lives under /platform-admin/* only, never under /workspace/*.
// =============================================================================

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Al Mizan — Platform Super Admin",
  robots: { index: false, follow: false },
};

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {children}
    </div>
  );
}
