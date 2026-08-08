"use client";

// =============================================================================
// Al Mizan — ServiceWorkerRegister
// -----------------------------------------------------------------------------
// Mounts once at the workspace root (page.tsx) and registers /sw.js so the
// app shell itself loads offline. The SW file lives in /public/sw.js and is
// served statically by Next.
//
// Guards:
//   • Only runs in the browser (useEffect).
//   • Only registers if 'serviceWorker' in navigator.
//   • Catches + logs errors silently — never blocks the app from loading.
// =============================================================================

import React, { useEffect } from "react";

export default function ServiceWorkerRegister(): React.JSX.Element | null {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    // Defer registration until after window load to avoid competing with
    // first-paint network requests.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // eslint-disable-next-line no-console
          console.info("[sw] registered with scope:", reg.scope);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("[sw] registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
