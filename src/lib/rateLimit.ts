import { logSecurityEvent } from "./auditLogger";
import { createRateLimitHtmlResponse } from "./rateLimitHtml";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

// In-memory fallback stores on globalThis (persists across Vite SSR re-evaluations in dev/preview)
const g = globalThis as any;
if (!g.__memoryRateLimitStore) {
  g.__memoryRateLimitStore = new Map<string, { count: number; windowStart: number }>();
}
if (!g.__memoryBlockedIps) {
  g.__memoryBlockedIps = new Map<string, number>();
}
const memoryRateLimitStore: Map<string, { count: number; windowStart: number }> = g.__memoryRateLimitStore;
const memoryBlockedIps: Map<string, number> = g.__memoryBlockedIps;

async function getRateLimitKv(): Promise<KVNamespace | null> {
  let cfEnv: any = {};
  try {
    const cf = await import("cloudflare:workers");
    cfEnv = cf.env || {};
  } catch {}

  const runtimeEnv = cfEnv || (typeof process !== "undefined" ? process.env : {});
  return ((runtimeEnv as any).RATE_LIMIT as KVNamespace) || null;
}

/**
 * Check if a client IP is currently on the active blocklist (e.g., honeypot trigger).
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  try {
    const now = Math.floor(Date.now() / 1000);

    // Check in-memory store (for preview/dev or fast cache)
    const memExpiresAt = memoryBlockedIps.get(ip);
    if (memExpiresAt) {
      if (now < memExpiresAt) return true;
      memoryBlockedIps.delete(ip);
    }

    const kv = await getRateLimitKv();
    if (!kv) return false;

    const blocked = await kv.get(`block:${ip}`);
    return Boolean(blocked);
  } catch (err) {
    console.error("[RateLimit] Error checking IP blocklist:", err);
    return false;
  }
}

/**
 * Place a malicious scraper IP on a temporary or 24-hour blocklist.
 */
export async function blockIp(ip: string, reason: string, durationSecs: number = 86400): Promise<void> {
  if (!ip || ip === "unknown") return;
  const now = Math.floor(Date.now() / 1000);
  memoryBlockedIps.set(ip, now + durationSecs);

  try {
    const kv = await getRateLimitKv();
    if (!kv) return;

    await kv.put(`block:${ip}`, JSON.stringify({ reason, blockedAt: now }), {
      expirationTtl: durationSecs,
    });

    logSecurityEvent({
      eventType: "ip_blocked",
      severity: "high",
      clientIp: ip,
      path: "*",
      method: "*",
      details: { reason, durationSecs },
    });
  } catch (err) {
    console.error("[RateLimit] Error writing IP block:", err);
  }
}

/**
 * Sliding window rate limiter for Cloudflare Workers & local preview.
 * Uses Cloudflare KV in production and falls back to an in-memory store in dev/preview.
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
    const now = Math.floor(Date.now() / 1000);

    // Check if key contains an IP that is directly blocked
    const ipPart = key.split(":")[1];
    if (ipPart && await isIpBlocked(ipPart)) {
      logSecurityEvent({
        eventType: "rate_limit_exceeded",
        severity: "medium",
        clientIp: ipPart,
        path: key,
        method: "RATE_LIMITED",
        details: { blocked: true, key },
      });
      return { allowed: false, remaining: 0, retryAfter: 86400 };
    }

    const kv = await getRateLimitKv();

    // 1. Production Mode: Use Cloudflare KV
    if (kv) {
      const kvKey = `rl:${key}`;
      const raw = await kv.get(kvKey);
      let record: { count: number; windowStart: number } | null = null;

      if (raw) {
        try {
          record = JSON.parse(raw);
        } catch {
          record = null;
        }
      }

      if (!record || now - record.windowStart >= windowSecs) {
        const newRecord = { count: 1, windowStart: now };
        await kv.put(kvKey, JSON.stringify(newRecord), { expirationTtl: Math.max(windowSecs, 60) });
        return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
      }

      if (record.count >= maxRequests) {
        const retryAfter = windowSecs - (now - record.windowStart);
        logSecurityEvent({
          eventType: "rate_limit_exceeded",
          severity: "low",
          clientIp: ipPart || "unknown",
          path: key,
          method: "RATE_LIMITED",
          details: { count: record.count, maxRequests, windowSecs },
        });
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.max(retryAfter, 1),
        };
      }

      record.count += 1;
      const remainingTtl = windowSecs - (now - record.windowStart);
      await kv.put(kvKey, JSON.stringify(record), { expirationTtl: Math.max(remainingTtl, 60) });

      return {
        allowed: true,
        remaining: maxRequests - record.count,
        retryAfter: 0,
      };
    }

    // 2. Dev / Local Preview Mode: Use In-Memory Store
    const memKey = `rl:${key}`;
    const memRecord = memoryRateLimitStore.get(memKey);

    if (!memRecord || now - memRecord.windowStart >= windowSecs) {
      memoryRateLimitStore.set(memKey, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
    }

    if (memRecord.count >= maxRequests) {
      const retryAfter = windowSecs - (now - memRecord.windowStart);
      logSecurityEvent({
        eventType: "rate_limit_exceeded",
        severity: "low",
        clientIp: ipPart || "unknown",
        path: key,
        method: "RATE_LIMITED",
        details: { count: memRecord.count, maxRequests, windowSecs, mode: "in-memory" },
      });
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(retryAfter, 1),
      };
    }

    memRecord.count += 1;
    memoryRateLimitStore.set(memKey, memRecord);

    return {
      allowed: true,
      remaining: maxRequests - memRecord.count,
      retryAfter: 0,
    };
  } catch (err) {
    console.error("[RateLimit] Error in rate limiter:", err);
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
 * Serves full-screen HTML with rate-limit.jpeg if text/html is accepted.
 */
export function tooManyRequests(retryAfter: number, message?: string, request?: Request): Response {
  if (request) {
    const accept = request.headers.get("accept") || "";
    const secFetchDest = request.headers.get("sec-fetch-dest") || "";
    if (accept.includes("text/html") || secFetchDest === "document") {
      return createRateLimitHtmlResponse(429, retryAfter);
    }
  }

  return new Response(
    JSON.stringify({
      error: message || "Too many requests. Please try again later.",
      rateLimited: true,
      imageUrl: "/images/rate-limit.jpeg",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "Set-Cookie": "api_rate_limit_lockout=1; max-age=900; path=/; SameSite=Lax",
      },
    }
  );
}

/**
 * Helper to build a standard 403 Forbidden response.
 */
export function forbiddenResponse(message?: string): Response {
  return new Response(
    JSON.stringify({ error: message || "Forbidden. Access denied." }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Helper to build a standard 401 Unauthorized response.
 */
export function unauthorizedResponse(message?: string): Response {
  return new Response(
    JSON.stringify({ error: message || "Authentication required." }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}

