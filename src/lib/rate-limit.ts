import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redisRatelimiters: {
  auth?: Ratelimit;
  ai?: Ratelimit;
  api?: Ratelimit;
} | null = null;

function getRedisRatelimiters() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!redisRatelimiters) {
    const redis = new Redis({ url, token });
    redisRatelimiters = {
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: true,
      }),
      ai: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: true,
      }),
      api: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, "1 m"),
        analytics: true,
      }),
    };
  }
  return redisRatelimiters;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
}

const buckets = new Map<string, Bucket>();

function memoryRateLimit(key: string, opts: RateLimitOptions): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { tokens: opts.capacity - 1, lastRefill: now });
    return { ok: true, remaining: opts.capacity - 1, retryAfterMs: 0 };
  }

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const refilled = Math.min(opts.capacity, bucket.tokens + elapsedSeconds * opts.refillPerSecond);
  bucket.tokens = refilled;
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
  }

  const retryAfterMs = Math.ceil((1 - bucket.tokens) / opts.refillPerSecond * 1000);
  return { ok: false, remaining: 0, retryAfterMs };
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function authRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = getRedisRatelimiters();
  if (redis?.auth) {
    const { success, remaining, reset } = await redis.auth.limit(ip);
    return {
      ok: success,
      remaining,
      retryAfterMs: Math.max(0, reset - Date.now()),
    };
  }
  return memoryRateLimit(`auth:${ip}`, { capacity: 10, refillPerSecond: 0.2 });
}

export async function aiRateLimit(ip: string, organizationId: string): Promise<RateLimitResult> {
  const key = `ai:${ip}:${organizationId}`;
  const redis = getRedisRatelimiters();
  if (redis?.ai) {
    const { success, remaining, reset } = await redis.ai.limit(key);
    return {
      ok: success,
      remaining,
      retryAfterMs: Math.max(0, reset - Date.now()),
    };
  }
  return memoryRateLimit(key, { capacity: 20, refillPerSecond: 0.5 });
}

export async function apiRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = getRedisRatelimiters();
  if (redis?.api) {
    const { success, remaining, reset } = await redis.api.limit(ip);
    return {
      ok: success,
      remaining,
      retryAfterMs: Math.max(0, reset - Date.now()),
    };
  }
  return memoryRateLimit(`api:${ip}`, { capacity: 120, refillPerSecond: 10 });
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
