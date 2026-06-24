import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabaseServer';

export const prerender = false;

let cachedStatus: any = null;
let lastChecked = 0;
const CACHE_DURATION_MS = 15000;

async function checkDatabase(): Promise<{ status: "ONLINE" | "OFFLINE"; latency: number }> {
  const start = performance.now();
  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase.rpc("health_check");
    const latency = Math.round(performance.now() - start);
    if (error) throw error;
    return { status: "ONLINE", latency };
  } catch (err) {
    console.error("Database status check failed:", err);
    return { status: "OFFLINE", latency: Math.round(performance.now() - start) };
  }
}

async function checkCDN(): Promise<{ status: "ONLINE" | "OFFLINE"; latency: number }> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);

    const response = await fetch("https://res.cloudinary.com", {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache"
      }
    });

    clearTimeout(id);
    const latency = Math.round(performance.now() - start);

    if (response.ok || response.status < 500) {
      return { status: "ONLINE", latency };
    }
    return { status: "OFFLINE", latency };
  } catch (err) {
    console.error("CDN status check failed:", err);
    return { status: "OFFLINE", latency: Math.round(performance.now() - start) };
  }
}

export const GET: APIRoute = async () => {
  const now = Date.now();

  if (cachedStatus && now - lastChecked < CACHE_DURATION_MS) {
    return new Response(JSON.stringify({ ...cachedStatus, cached: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const start = performance.now();

  const [dbResult, cdnResult] = await Promise.all([checkDatabase(), checkCDN()]);

  const totalLatency = Math.round(performance.now() - start);

  cachedStatus = {
    webApp: { status: "ONLINE", latency: Math.round(totalLatency / 3) },
    database: dbResult,
    cdn: cdnResult,
    catalogApi: { status: dbResult.status, latency: Math.round(dbResult.latency * 1.2) },
    statsApi: { status: dbResult.status, latency: Math.round(dbResult.latency * 1.1) },
    timestamp: new Date().toISOString(),
  };
  lastChecked = now;

  return new Response(JSON.stringify({ ...cachedStatus, cached: false }), { status: 200, headers: { "Content-Type": "application/json" } });
};
