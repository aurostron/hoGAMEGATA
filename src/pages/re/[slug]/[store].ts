import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { generateAffiliateLink } from '../../../lib/affiliate';

export const prerender = false;

function matchStoreName(slug: string): string {
  const s = slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("steam")) return "Steam";
  if (s.includes("gog")) return "GOG";
  if (s.includes("humble")) return "Humble Store";
  if (s.includes("fanatical")) return "Fanatical";
  if (s.includes("epic")) return "Epic Games Store";
  if (s.includes("greenman") || s.includes("gmg")) return "GreenManGaming";
  if (s.includes("gamersgate")) return "GamersGate";
  if (s.includes("gamebillet")) return "GameBillet";
  if (s.includes("voidu")) return "Voidu";
  return slug;
}

export const GET: APIRoute = async ({ params, request }) => {
  const { slug = "", store = "" } = params;
  const { searchParams } = new URL(request.url);
  const fallbackUrl = searchParams.get("fallbackUrl") || "";
  const gameId = searchParams.get("gameId") || "";

  try {
    const supabase = getSupabaseServer();

    // 1. Resolve the Game from database
    let game = null;
    if (gameId) {
      const { data } = await supabase
        .from("Game")
        .select("id, slug, purchaseLinks:PurchaseLink(id, storeName, url)")
        .eq("id", gameId)
        .limit(1)
        .maybeSingle();
      game = data;
    }

    if (!game && slug) {
      const { data } = await supabase
        .from("Game")
        .select("id, slug, purchaseLinks:PurchaseLink(id, storeName, url)")
        .eq("slug", slug)
        .limit(1)
        .maybeSingle();
      game = data;
    }

    if (!game) {
      console.warn(`[Redirect Warning] Game not found for ID: "${gameId}" / Slug: "${slug}"`);
      return new Response(null, {
        status: 307,
        headers: { Location: fallbackUrl || new URL("/", request.url).toString() }
      });
    }

    // 2. Resolve store name and find clean purchase link
    const targetStoreName = matchStoreName(store);
    const purchaseLinks = game.purchaseLinks as any[];
    const cleanLink = purchaseLinks?.find(
      (link: any) => link.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") === targetStoreName.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    let finalRedirectionUrl = fallbackUrl;

    if (cleanLink && cleanLink.url) {
      let targetUrl = cleanLink.url;
      // If store is itch.io, append /purchase to open the payment overlay directly
      if (cleanLink.storeName.toLowerCase() === "itch.io" && !targetUrl.endsWith("/purchase")) {
        targetUrl = `${targetUrl.replace(/\/$/, "")}/purchase`;
      }
      finalRedirectionUrl = generateAffiliateLink(cleanLink.storeName, targetUrl);
    }

    if (!finalRedirectionUrl) {
      finalRedirectionUrl = cleanLink?.url || fallbackUrl || new URL("/", request.url).toString();
    }

    // 3. Log referral click in database
    try {
      await supabase.from("ReferralClick").insert({
        gameId: game.id,
        storeName: cleanLink?.storeName || targetStoreName,
        targetUrl: finalRedirectionUrl,
      });
    } catch (dbErr) {
      console.error("[Redirect Analytics Error] Failed to log ReferralClick:", dbErr);
    }

    // 4. Temporary Redirect (307) to the affiliate link
    return new Response(null, {
      status: 307,
      headers: { Location: finalRedirectionUrl }
    });
  } catch (error) {
    console.error(`[Redirect Exception] Error redirecting slug "${slug}" to store "${store}":`, error);
    return new Response(null, {
      status: 307,
      headers: { Location: fallbackUrl || new URL("/", request.url).toString() }
    });
  }
};
