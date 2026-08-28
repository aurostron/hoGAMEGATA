import type { APIRoute } from 'astro';
import { lazyGetPrices } from '../../../../lib/priceEngine';
import { initTursoForRequest } from '../../../../lib/turso';
import { env as cfWorkerEnv } from "cloudflare:workers";
import { rateLimit, getClientIp, tooManyRequests } from '../../../../lib/rateLimit';

export const prerender = false;

const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');

export const POST: APIRoute = async ({ params, request }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`prices:${clientIp}`, 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfWorkerEnv)
    : (cfWorkerEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);
  try {
    const id = params.id;
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: id" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { title, purchaseLinks, country, forceRefresh, provider = "direct" } = body;

    if (!title || !Array.isArray(purchaseLinks)) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: title, purchaseLinks" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let targetCountry = country;
    if (!targetCountry || targetCountry === "detect") {
      const geoHeaders = [
        "x-vercel-ip-country",
        "x-country",
        "x-nf-country-code",
        "cf-ipcountry",
        "cloudfront-viewer-country"
      ];
      for (const h of geoHeaders) {
        const val = request.headers.get(h);
        if (val && val.length === 2) {
          targetCountry = val.toUpperCase();
          break;
        }
      }
      if (!targetCountry) {
        targetCountry = "US"; // default fallback
      }
    }

    const isStrictRefresh = Boolean(forceRefresh);
    const deals = await lazyGetPrices(id, title, purchaseLinks, targetCountry, isStrictRefresh, provider);

    return new Response(
      JSON.stringify({ deals, country: targetCountry }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        } 
      }
    );
  } catch (error) {
    console.error(`[Pricing API Error] Failed to fetch prices for game:`, error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error while fetching prices",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
