"use client";

// =============================================================================
// HashRedirect — migrates legacy hash bookmarks (#view/matterId/mode) to the
// real App Router paths exactly once. Mounted inside the workspace and client
// portal shells so old links keep working.
// =============================================================================

import { useEffect, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { legacyHashToPath } from "@/lib/navigation";

export default function HashRedirect(): ReactElement | null {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash === "#") return;

    const path = legacyHashToPath(hash);
    if (!path) return;

    // Clear the legacy hash so the next hashchange/refresh won't re-fire.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    router.replace(path);
  }, [router]);

  return null;
}
