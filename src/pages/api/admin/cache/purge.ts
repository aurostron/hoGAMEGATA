import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { purgeCloudflareUrls, purgeGameCache } from '../../../../lib/cloudflareCache';

let cfEnv: any = null;
try {
  const { env } = await import("cloudflare:workers");
  cfEnv = env;
} catch (e) {}

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Verify session and Admin rights
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const isAdmin = isAdminUser(user.email, cfEnv);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden. Admin access required." }), { status: 403 });
    }

    // 2. Parse request payload
    const body = await request.json().catch(() => ({}));
    const { slug, urls } = body as { slug?: string; urls?: string[] };

    let result;
    if (slug) {
      result = await purgeGameCache(slug, cfEnv);
    } else if (urls && Array.isArray(urls) && urls.length > 0) {
      result = await purgeCloudflareUrls(urls, cfEnv);
    } else {
      // Default: purge directory and games catalog index
      result = await purgeCloudflareUrls([
        "https://gamegata.xyz/directory",
        "https://gamegata.xyz/games"
      ], cfEnv);
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Cache purge API error:", error);
    return new Response(JSON.stringify({ error: "Failed to purge cache" }), { status: 500 });
  }
};
