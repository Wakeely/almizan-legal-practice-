/* =============================================================================
 * Al Mizan Legal Practice — Service Worker
 * -----------------------------------------------------------------------------
 * Goal: make the app shell itself load offline (true PWA). Once the SW is
 * installed, a full refresh while offline still loads the HTML shell + main
 * JS bundles + fonts + logo, then React hydrates and reads its data from
 * IndexedDB (see src/lib/offline-storage.ts).
 *
 * Strategy:
 *   • App shell (HTML, JS, CSS, fonts, logo, manifest) → cache-first.
 *     On first hit, fetch from network, store in `almizan-shell-v1`.
 *     On subsequent hits, serve from cache immediately, then optionally
 *     update in background (stale-while-revalidate for navigations).
 *   • API routes (/api/*) → network-first. If the network fails, fall back to
 *     cache (only GET responses are cached). Mutations are NEVER cached here —
 *     they are handled by the IndexedDB pending-mutation queue
 *     (see src/lib/offline-fetch.ts).
 *   • Same-origin only. Cross-origin requests (e.g. Google Fonts CSS preloads)
 *     are pass-through.
 *
 * Bumping the cache version (`almizan-shell-v2`) on any deploy that changes
 * static asset hashes causes `activate` to evict the old cache.
 * ========================================================================== */

const SHELL_CACHE = "almizan-shell-v1";
const API_CACHE = "almizan-api-v1";
const OFFLINE_URL = "/offline.html";

// Assets to pre-cache on install. We keep this list small + deterministic.
// Next.js build chunks are hashed and discovered at runtime; we rely on the
// runtime cache-first fallback below to capture them on first navigation.
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/logo-square.svg",
  "/logo.svg",
  "/logo-header.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Use addAll with tolerance for individual failures (offline.html may
      // not exist on older deploys).
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await cache.put(url, res.clone());
          } catch (_e) {
            /* ignore individual precache failures */
          }
        }),
      );
      // Activate immediately so the SW controls the page on first load.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Evict old cache versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET. Mutations (POST/PUT/PATCH/DELETE) MUST bypass the SW so
  // the offline-fetch wrapper can intercept them.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin only.
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR + dev-only endpoints.
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // ---- API routes: network-first, fall back to cache ----
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(req));
    return;
  }

  // ---- App shell + static assets: stale-while-revalidate ----
  event.respondWith(staleWhileRevalidateShell(req));
});

async function networkFirstApi(req) {
  const cache = await caches.open(API_CACHE);
  try {
    const networkRes = await fetch(req);
    // Only cache successful 2xx GET responses.
    if (networkRes && networkRes.ok && networkRes.status === 200) {
      // Don't clone streaming responses (streams). Only cache if readable.
      try {
        await cache.put(req, networkRes.clone());
      } catch (_e) {
        /* ignore cache put failures */
      }
    }
    return networkRes;
  } catch (_err) {
    // Network failed → try cache.
    const cached = await cache.match(req);
    if (cached) return cached;
    // No cache → return a minimal 503 so the calling module falls back to
    // IndexedDB (which it already does).
    return new Response(
      JSON.stringify({ error: "offline", message: "Network unavailable" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function staleWhileRevalidateShell(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);

  // If this is a navigation request and we have a cached shell, prefer it
  // immediately and revalidate in background.
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    // For navigations, fall back to cached "/" shell if the URL itself isn't
    // cached (single-page app, all routes render the same root).
    const shellResponse = cached || (await cache.match("/"));
    if (shellResponse) {
      // Revalidate in background.
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            cache.put(req, networkRes.clone()).catch(() => {});
          }
        })
        .catch(() => {});
      return shellResponse;
    }
    // No cached shell → try network, otherwise offline page.
    try {
      const networkRes = await fetch(req);
      if (networkRes && networkRes.ok) {
        cache.put(req, networkRes.clone()).catch(() => {});
      }
      return networkRes;
    } catch (_err) {
      const offline = await cache.match(OFFLINE_URL);
      return (
        offline ||
        new Response(
          "<h1>Offline</h1><p>Al Mizan is offline and this page is not cached.</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        )
      );
    }
  }

  // Non-navigation GET (script, style, image, font, etc.) — SWR.
  const networkPromise = fetch(req)
    .then((networkRes) => {
      if (networkRes && networkRes.ok) {
        // Only cache same-origin basic responses (skip opaque / cors).
        if (networkRes.type === "basic" || networkRes.type === "cors") {
          cache.put(req, networkRes.clone()).catch(() => {});
        }
      }
      return networkRes;
    })
    .catch(() => null);

  if (cached) {
    // Serve stale, update in background.
    return cached;
  }

  const networkRes = await networkPromise;
  if (networkRes) return networkRes;

  return new Response("Offline and resource not cached.", {
    status: 504,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Allow the page to trigger an immediate update (skipWaiting) via postMessage.
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
