// =============================================================================
// Al Mizan Legal Practice — offline-aware fetch wrapper
// -----------------------------------------------------------------------------
// Thin wrapper around `fetch()` that:
//   • For GET requests: passes through unchanged (read caching is handled by
//     each module's existing write-back-on-success pattern).
//   • For mutating requests (POST/PUT/PATCH/DELETE):
//       - If `navigator.onLine === false`, enqueue the mutation in IndexedDB
//         and return a synthetic "queued" Response so the UI stays responsive.
//       - If online but the underlying fetch throws a network error (e.g.
//         server unreachable mid-request), also enqueue and return synthetic.
//       - Otherwise behave like normal fetch.
//
// The actual flush of the pending queue happens in
// `flushPendingMutations()` (called by the useOfflineSync hook when the
// browser fires the `online` event or `visibilitychange`).
//
// Conflict strategy: simple last-write-wins using the mutation `timestamp`.
// When two queued mutations target the same resource, the later one wins on
// flush (the earlier one is still sent but may be overridden). For richer
// conflict handling, see README "Limitations".
// =============================================================================

import {
  enqueueMutation,
  type PendingMutation,
} from "@/lib/offline-storage";

/**
 * Generate a reasonably-unique id without bringing in `uuid` (already a dep,
 * but we want this layer to stay trivially side-effect-free).
 */
function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Try to extract the JSON body (or any text body) from a RequestInit for
 * queuing. Returns undefined for FormData / empty bodies.
 */
function extractBody(body: BodyInit | null | undefined): unknown {
  if (body == null) return undefined;
  if (typeof body === "string") {
    // Try JSON parse — fall back to raw string.
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  // FormData / Blob / ArrayBuffer / ReadableStream — we can't safely serialize
  // these to IndexedDB, so skip the body and just queue metadata. The flush
  // step will mark these as failed-with-reason if encountered.
  if (body instanceof FormData) {
    return { __formData: true };
  }
  return undefined;
}

/**
 * Parse a URL to extract matterId / resourceType / resourceId when possible.
 * Used to annotate queued mutations so the flush step + UI can reason about
 * them.
 */
function inferContext(
  url: string,
  method: string,
): Pick<PendingMutation, "matterId" | "resourceType" | "resourceId"> {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const parts = u.pathname.split("/").filter(Boolean);
    // Patterns we care about:
    //   /api/matters/{matterId}/tasks
    //   /api/matters/{matterId}/documents
    //   /api/matters/{matterId}/billing
    //   /api/matters/{matterId}/calendar
    //   /api/tasks/{id}
    //   /api/documents/{id}
    //   /api/invoices/{id}
    //   /api/invoices
    //   /api/time-entries
    //   /api/calendar/events/{id}
    const ctx: Pick<PendingMutation, "matterId" | "resourceType" | "resourceId"> = {};
    if (parts[0] === "api") {
      if (parts[1] === "matters" && parts[2]) {
        ctx.matterId = parts[2];
        if (parts[3]) ctx.resourceType = parts[3];
        if (parts[4]) ctx.resourceId = parts[4];
      } else if (parts[1] === "tasks" && parts[2]) {
        ctx.resourceType = "tasks";
        ctx.resourceId = parts[2];
      } else if (parts[1] === "documents" && parts[2]) {
        ctx.resourceType = "documents";
        ctx.resourceId = parts[2];
      } else if (parts[1] === "invoices" && parts[2]) {
        ctx.resourceType = "invoices";
        ctx.resourceId = parts[2];
      } else if (parts[1] === "invoices") {
        ctx.resourceType = "invoices";
      } else if (parts[1] === "time-entries") {
        ctx.resourceType = "time_entries";
      } else if (parts[1] === "calendar" && parts[2] === "events") {
        ctx.resourceType = "calendar_events";
        if (parts[3]) ctx.resourceId = parts[3];
      }
    }
    return ctx;
  } catch {
    return {};
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Synthetic response returned when a mutation is queued offline.
 *
 * Status 202 (Accepted) signals "received but not yet applied". Body carries
 * a `__queuedOffline` flag so callers (if they care) can distinguish.
 */
function syntheticQueuedResponse(body?: unknown): Response {
  const payload = JSON.stringify({
    __queuedOffline: true,
    queuedAt: Date.now(),
    body: body ?? null,
  });
  return new Response(payload, {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Detect whether a fetch error is a "network" error (vs. an HTTP error
 * response, which is just returned normally).
 */
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  // Typical fetch network error messages:
  //   "Failed to fetch" (Chrome)
  //   "NetworkError when attempting to fetch resource" (Firefox)
  const msg = err.message || "";
  return /failed to fetch|networkerror|load failed/i.test(msg);
}

export interface OfflineFetchOptions extends RequestInit {
  /**
   * If true (default), mutations performed while offline are queued and a
   * synthetic 202 response is returned. If false, the underlying fetch error
   * is propagated.
   */
  queueIfOffline?: boolean;
}

/**
 * Offline-aware fetch wrapper. See file header for behaviour.
 *
 * For non-mutating requests, this is functionally identical to `fetch()`.
 */
export async function offlineFetch(
  input: string | URL,
  init: OfflineFetchOptions = {},
): Promise<Response> {
  const { queueIfOffline = true, ...fetchInit } = init;
  const method = (fetchInit.method || "GET").toUpperCase();
  const url = typeof input === "string" ? input : input.toString();

  // Non-mutating request → just pass through. Caching is handled by the
  // modules' read-fallback pattern.
  if (!MUTATING_METHODS.has(method)) {
    return fetch(input, fetchInit);
  }

  const isOnline =
    typeof navigator === "undefined" ? true : navigator.onLine !== false;

  // Fast path: online → just fetch.
  if (isOnline && queueIfOffline) {
    try {
      return await fetch(input, fetchInit);
    } catch (err) {
      // Network error mid-flight (e.g. wifi dropped while waiting for response).
      // Queue the mutation so it gets retried.
      if (isNetworkError(err)) {
        return queueMutation(url, fetchInit, method);
      }
      throw err;
    }
  }

  if (isOnline && !queueIfOffline) {
    return fetch(input, fetchInit);
  }

  // Offline → queue.
  if (queueIfOffline) {
    return queueMutation(url, fetchInit, method);
  }

  // queueIfOffline === false → throw to mimic a normal network failure.
  throw new TypeError("Failed to fetch (offline)");
}

async function queueMutation(
  url: string,
  init: RequestInit,
  method: string,
): Promise<Response> {
  const body = extractBody(init.body);
  const headers: Record<string, string> = {};
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) headers[k] = v;
    } else {
      for (const [k, v] of Object.entries(init.headers)) {
        headers[k] = String(v);
      }
    }
  }
  const ctx = inferContext(url, method);
  const mutation: PendingMutation = {
    id: generateId(),
    method: method as PendingMutation["method"],
    url,
    body,
    headers,
    timestamp: Date.now(),
    ...ctx,
  };
  await enqueueMutation(mutation);
  return syntheticQueuedResponse(body);
}

/**
 * Replay a single queued mutation against the live server. Returns the
 * Response (so the caller can detect 2xx / 4xx). Does NOT remove the mutation
 * from the queue — that is the caller's responsibility on success.
 *
 * Body serialisation: we stored the parsed JSON body (or undefined for
 * FormData). Re-serialise to JSON for the network request. FormData mutations
 * cannot be replayed this way and will return a synthetic 400.
 */
export async function replayMutation(
  mutation: PendingMutation,
): Promise<Response> {
  const init: RequestInit = {
    method: mutation.method,
    headers: mutation.headers,
    credentials: "same-origin",
  };

  if (mutation.body != null) {
    if (
      typeof mutation.body === "object" &&
      mutation.body !== null &&
      "__formData" in mutation.body
    ) {
      // Can't replay FormData mutations — caller should mark as failed.
      return new Response(
        JSON.stringify({
          error: "FormData mutations cannot be replayed offline",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    init.body =
      typeof mutation.body === "string"
        ? mutation.body
        : JSON.stringify(mutation.body);
    if (!init.headers) init.headers = {};
    if (init.headers instanceof Headers) {
      if (!init.headers.has("Content-Type")) {
        init.headers.set("Content-Type", "application/json");
      }
    } else if (Array.isArray(init.headers)) {
      // Skip — rare path.
    } else {
      const h = init.headers as Record<string, string>;
      if (!h["Content-Type"] && !h["content-type"]) {
        h["Content-Type"] = "application/json";
      }
    }
  }

  return fetch(mutation.url, init);
}

/**
 * Convenience helper: returns true if a Response came from the offline queue
 * (i.e. it was synthetically generated by `offlineFetch`).
 */
export function isQueuedOfflineResponse(res: Response): boolean {
  return res.status === 202 && res.headers.get("Content-Type") === "application/json";
}
