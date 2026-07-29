import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../lib/serverAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    let cfEnv: any = null;
    try {
      const { env } = await import("cloudflare:workers");
      cfEnv = env;
    } catch (e) {}

    const user = await getServerUser(request, cookies);
    if (!user || !isAdminUser(user.email, cfEnv)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Check providers in parallel with 2.5s timeouts
    const checkProvider = async (name: string, pingFn: () => Promise<boolean>) => {
      const start = Date.now();
      try {
        const ok = await pingFn();
        const latency = Date.now() - start;
        return { name, status: ok ? "online" : "offline", latencyMs: latency };
      } catch {
        return { name, status: "offline", latencyMs: Date.now() - start };
      }
    };

    const results = await Promise.all([
      checkProvider("freeimage", async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        try {
          const res = await fetch("https://freeimage.host", { method: "GET", signal: controller.signal });
          clearTimeout(timer);
          return res.ok || res.status < 500;
        } catch {
          clearTimeout(timer);
          return false;
        }
      }),
      checkProvider("catbox", async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        try {
          const res = await fetch("https://catbox.moe", { method: "GET", signal: controller.signal });
          clearTimeout(timer);
          return res.ok || res.status < 500;
        } catch {
          clearTimeout(timer);
          return false;
        }
      }),
      checkProvider("tmpfiles", async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        try {
          const res = await fetch("https://tmpfiles.org", { method: "GET", signal: controller.signal });
          clearTimeout(timer);
          return res.ok || res.status < 500;
        } catch {
          clearTimeout(timer);
          return false;
        }
      }),
    ]);

    return new Response(JSON.stringify({ providers: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Upload status endpoint error:", err);
    return new Response(JSON.stringify({ error: "Failed to check status" }), { status: 500 });
  }
};
