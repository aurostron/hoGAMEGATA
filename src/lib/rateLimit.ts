import { env as cfEnv } from "cloudflare:workers";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/**
 * KV-based sliding window rate limiter for Cloudflare Workers.
 *
 * Uses Cloudflare KV with TTL-based auto-expiry — no cleanup needed.
 * Not perfectly accurate under extreme concurrency (KV is eventually consistent),
 * but sufficient for abuse prevention.
 *
 * @param key        Unique rate limit key, e.g. `"likes:192.168.1.1"`
 * @param maxRequests Maximum allowed requests within the window
 * @param windowSecs  Window duration in seconds
 * @returns          `{ allowed, remaining, retryAfter }`
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSecs: number
): Promise<RateLimitResult> {
  try {
    const isDev =
      import.meta.env?.DEV ||
      (typeof process !== "undefined" &&
        process.env &&
        process.env.NODE_ENV === "development");

    // Skip rate limiting in development
    if (isDev) {
      return { allowed: true, remaining: maxRequests, retryAfter: 0 };
    }

    const runtimeEnv = cfEnv || (typeof process !== "undefined" ? process.env : {});
    const kv = (runtimeEnv as any).RATE_LIMIT as KVNamespace | undefined;

    // If KV binding is not available, fail open (allow the request)
    if (!kv) {
      console.warn("[RateLimit] RATE_LIMIT KV namespace not bound — skipping rate limit");
      return { allowed: true, remaining: maxRequests, retryAfter: 0 };
    }

    const kvKey = `rl:${key}`;
    const now = Math.floor(Date.now() / 1000);

    const raw = await kv.get(kvKey);
    let record: { count: number; windowStart: number } | null = null;

    if (raw) {
      try {
        record = JSON.parse(raw);
      } catch {
        record = null;
      }
    }

    // If no record or window has expired, start a fresh window
    if (!record || now - record.windowStart >= windowSecs) {
      const newRecord = { count: 1, windowStart: now };
      await kv.put(kvKey, JSON.stringify(newRecord), {
        expirationTtl: windowSecs,
      });
      return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
    }

    // Window is still active
    if (record.count >= maxRequests) {
      const retryAfter = windowSecs - (now - record.windowStart);
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(retryAfter, 1),
      };
    }

    // Increment counter within the existing window
    record.count += 1;
    const remainingTtl = windowSecs - (now - record.windowStart);
    await kv.put(kvKey, JSON.stringify(record), {
      expirationTtl: Math.max(remainingTtl, 1),
    });

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      retryAfter: 0,
    };
  } catch (err) {
    // On any KV error, fail open — never block legitimate users due to infra issues
    console.error("[RateLimit] KV error, failing open:", err);
    return { allowed: true, remaining: maxRequests, retryAfter: 0 };
  }
}

/**
 * Helper to extract client IP from a Cloudflare Workers request.
 */
export function getClientIp(request: Request, fallback?: string): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    fallback ||
    "unknown"
  );
}

/**
 * Helper to build a standard 429 Too Many Requests response.
 */
export function tooManyRequests(retryAfter: number, message?: string): Response {
  return new Response(
    JSON.stringify({ error: message || "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
