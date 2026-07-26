// =============================================================================
// Al Mizan — rate limiter (in-memory token bucket)
// -----------------------------------------------------------------------------
// MVP implementation: in-memory token bucket per IP+route. State is lost on
// restart and not shared across instances. For production multi-instance
// deployments, replace with Redis (see README → Current Limitations).
// =============================================================================

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  // Maximum tokens (burst capacity)
  capacity: number;
  // Tokens added per second (sustained rate)
  refillPerSecond: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: RateLimitOptions): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { tokens: opts.capacity - 1, lastRefill: now });
    return { ok: true, remaining: opts.capacity - 1, retryAfterMs: 0 };
  }

  // Refill tokens based on elapsed time
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const refilled = Math.min(opts.capacity, bucket.tokens + elapsedSeconds * opts.refillPerSecond);
  bucket.tokens = refilled;
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
  }

  // Calculate retry-after (ms until 1 token refills)
  const retryAfterMs = Math.ceil((1 - bucket.tokens) / opts.refillPerSecond * 1000);
  return { ok: false, remaining: 0, retryAfterMs };
}

// Pre-configured limiters
export function authRateLimit(ip: string) {
  return rateLimit(`auth:${ip}`, { capacity: 10, refillPerSecond: 0.2 }); // 10 bursts, 1 per 5s
}

export function aiRateLimit(ip: string, organizationId: string) {
  return rateLimit(`ai:${ip}:${organizationId}`, { capacity: 20, refillPerSecond: 0.5 }); // 20 bursts, 1 per 2s
}

export function apiRateLimit(ip: string) {
  return rateLimit(`api:${ip}`, { capacity: 120, refillPerSecond: 10 }); // 120 bursts, 10/s
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
