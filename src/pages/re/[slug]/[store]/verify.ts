import type { APIRoute } from 'astro';
import { generateAffiliateLink } from '../../../../lib/affiliate';
import { turso, initTursoForRequest } from '../../../../lib/turso';
import { tursoAuth, initTursoAuthForRequest } from '../../../../lib/tursoAuth';
import { referralClick as referralClickTable } from '../../../../db/auth-schema';
import { games as gamesTable, purchaseLinks as purchaseLinksTable } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { env as cfWorkerEnv } from "cloudflare:workers";

export const prerender = false;

const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');

function matchStoreName(slug: string): string {
  const s = slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("steam")) return "Steam";
  if (s.includes("gog")) return "GOG";
  if (s.includes("humble")) return "Humble Store";
  if (s.includes("fanatical")) return "Fanatical";
  if (s.includes("epic")) return "Epic Games Store";
  if (s.includes("greenman") || s.includes("gmg")) return "Green Man Gaming";
  if (s.includes("microsoft") || s.includes("xbox") || s.includes("msstore")) return "Microsoft Store";
  if (s.includes("gamersgate")) return "GamersGate";
  if (s.includes("gamebillet")) return "GameBillet";
  if (s.includes("voidu")) return "Voidu";
  if (s.includes("itch")) return "itch.io";
  return slug;
}

export const POST: APIRoute = async (context) => {
  const { params, request } = context;
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfWorkerEnv)
    : (cfWorkerEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);
  initTursoAuthForRequest(runtimeEnv);

  const { slug = "", store = "" } = params;
  const { searchParams } = new URL(request.url);
  const fallbackUrl = searchParams.get("fallbackUrl") || "";
  const gameId = searchParams.get("gameId") || "";

  try {
    const body = await request.json().catch(() => ({}));
    const token = body?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Turnstile verification token" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Verify Cloudflare Turnstile Captcha
    const secretKey = (runtimeEnv as any)?.TURNSTILE_SECRET_KEY
      || (typeof process !== "undefined" && process.env?.TURNSTILE_SECRET_KEY)
      || import.meta.env.TURNSTILE_SECRET_KEY
      || "";

    const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

    let isCaptchaValid = false;
    if (isDev && (token === 'XXXX.DUMMY.TOKEN.XXXX' || token.startsWith('XXXX.') || !secretKey || secretKey.startsWith('1x000000'))) {
      isCaptchaValid = true;
    } else {
      try {
        const verifyParams = new URLSearchParams({
          secret: secretKey,
          response: token,
          ...(clientIp ? { remoteip: clientIp } : {})
        });

        const cfVerifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: verifyParams.toString(),
          signal: AbortSignal.timeout(4000)
        });

        const cfVerifyData = await cfVerifyResponse.json().catch(() => null) as any;
        if (cfVerifyData && cfVerifyData.success) {
          isCaptchaValid = true;
        } else {
          console.warn("[Turnstile Validation Fail] Response:", cfVerifyData);
          const errorCodes = cfVerifyData?.["error-codes"] || [];
          // If domain-mismatch or secret issue occurs in preview/dev or edge environment, allow graceful pass
          if (errorCodes.includes("domain-mismatch") || errorCodes.includes("invalid-input-secret") || errorCodes.includes("timeout-or-duplicate")) {
            console.warn("[Turnstile Warning] Proceeding with graceful redirect fallback for:", errorCodes);
            isCaptchaValid = true;
          }
        }
      } catch (e) {
        console.error("[Turnstile Verification Network Error]", e);
        // Fail-open for user outbound store link redirects so users aren't locked out
        isCaptchaValid = true;
      }
    }

    if (!isCaptchaValid) {
      return new Response(JSON.stringify({ 
        error: "Verification failed. Please try again or click to continue.",
        allowManual: true
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Resolve the Game from database (Turso Catalog DB)
    let game = null;
    if (gameId) {
      const [gameRow] = await turso
        .select({ id: gamesTable.id, slug: gamesTable.slug })
        .from(gamesTable)
        .where(eq(gamesTable.id, gameId))
        .limit(1);
      
      if (gameRow) {
        const links = await turso
          .select({ storeName: purchaseLinksTable.storeName, url: purchaseLinksTable.url })
          .from(purchaseLinksTable)
          .where(eq(purchaseLinksTable.gameId, gameRow.id));
        
        game = { ...gameRow, purchaseLinks: links };
      }
    }

    if (!game && slug) {
      const [gameRow] = await turso
        .select({ id: gamesTable.id, slug: gamesTable.slug })
        .from(gamesTable)
        .where(eq(gamesTable.slug, slug))
        .limit(1);
      
      if (gameRow) {
        const links = await turso
          .select({ storeName: purchaseLinksTable.storeName, url: purchaseLinksTable.url })
          .from(purchaseLinksTable)
          .where(eq(purchaseLinksTable.gameId, gameRow.id));
        
        game = { ...gameRow, purchaseLinks: links };
      }
    }

    if (!game) {
      console.warn(`[Redirect Gateway Error] Game not found for ID: "${gameId}" / Slug: "${slug}"`);
      return new Response(JSON.stringify({ redirectUrl: fallbackUrl || new URL("/", request.url).toString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Resolve store name and find clean purchase link
    const targetStoreName = matchStoreName(store);
    const purchaseLinks = game.purchaseLinks as any[];
    const isItchGame = Boolean(game.slug?.startsWith("itch-"));

    let cleanLink = purchaseLinks?.find(
      (link: any) => {
        const s = (link.storeName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const t = targetStoreName.toLowerCase().replace(/[^a-z0-9]/g, "");
        return s === t || (t.includes("itch") && s.includes("itch"));
      }
    );

    // If this is an itch game, strictly ensure we redirect to itch.io and NEVER to Steam or other stores
    if (isItchGame && (!cleanLink || !cleanLink.url?.includes("itch.io"))) {
      cleanLink = purchaseLinks?.find((link: any) =>
        link.storeName?.toLowerCase().includes("itch") || link.url?.includes("itch.io")
      );
    }

    let finalRedirectionUrl = fallbackUrl;
    if (isItchGame && fallbackUrl && !fallbackUrl.includes("itch.io")) {
      finalRedirectionUrl = "";
    }

    if (cleanLink && cleanLink.url) {
      let targetUrl = cleanLink.url;
      // Strip /purchase: free itch.io games return 404 from itch.io if /purchase is requested!
      if (cleanLink.storeName.toLowerCase() === "itch.io" && targetUrl.endsWith("/purchase")) {
        targetUrl = targetUrl.replace(/\/purchase$/, "");
      }
      finalRedirectionUrl = generateAffiliateLink(cleanLink.storeName, targetUrl);
    }

    if (!finalRedirectionUrl) {
      finalRedirectionUrl = cleanLink?.url || (isItchGame ? "" : fallbackUrl) || new URL("/", request.url).toString();
    }

    if (finalRedirectionUrl && finalRedirectionUrl.includes("itch.io") && finalRedirectionUrl.endsWith("/purchase")) {
      finalRedirectionUrl = finalRedirectionUrl.replace(/\/purchase$/, "");
    }

    // 4. Log referral click in database (separate Auth/User DB)
    try {
      await tursoAuth.insert(referralClickTable).values({
        id: crypto.randomUUID(),
        gameId: game.id,
        storeName: cleanLink?.storeName || targetStoreName,
        targetUrl: finalRedirectionUrl,
      });
    } catch (dbErr) {
      console.error("[Redirect Analytics Error] Failed to log ReferralClick:", dbErr);
    }

    // 5. Return target URL
    return new Response(JSON.stringify({ redirectUrl: finalRedirectionUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[Redirect Exception] Error verifying slug "${slug}" to store "${store}":`, error);
    return new Response(JSON.stringify({ redirectUrl: fallbackUrl || new URL("/", request.url).toString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
