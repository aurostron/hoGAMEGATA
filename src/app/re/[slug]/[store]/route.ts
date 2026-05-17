import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateAffiliateLink } from "@/lib/affiliate";

interface RouteParams {
  params: Promise<{
    slug: string;
    store: string;
  }>;
}

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

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug, store } = await params;
  const { searchParams } = new URL(request.url);
  const fallbackUrl = searchParams.get("fallbackUrl") || "";
  const gameId = searchParams.get("gameId") || "";

  try {
    // 1. Resolve the Game from database
    let game = null;
    if (gameId) {
      game = await db.game.findUnique({
        where: { id: gameId },
        include: { purchaseLinks: true }
      });
    }

    if (!game && slug) {
      game = await db.game.findUnique({
        where: { slug },
        include: { purchaseLinks: true }
      });
    }

    if (!game) {
      console.warn(`[Redirect Warning] Game not found for ID: "${gameId}" / Slug: "${slug}"`);
      // Fail-safe: redirect to fallbackUrl or home
      return NextResponse.redirect(fallbackUrl || new URL("/", request.url).toString(), 307);
    }

    // 2. Resolve database storeName and search for clean purchase link
    const targetStoreName = matchStoreName(store);
    const cleanLink = game.purchaseLinks.find(
      (link) => link.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") === targetStoreName.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    let finalRedirectionUrl = fallbackUrl;

    if (cleanLink && cleanLink.url) {
      // Clean link exists, wrap with our affiliate tags
      finalRedirectionUrl = generateAffiliateLink(cleanLink.storeName, cleanLink.url);
    }

    // Fail-safe check
    if (!finalRedirectionUrl) {
      finalRedirectionUrl = cleanLink?.url || fallbackUrl || new URL("/", request.url).toString();
    }

    // 3. Log referral click in database for monetization analytics
    try {
      await db.referralClick.create({
        data: {
          gameId: game.id,
          storeName: cleanLink?.storeName || targetStoreName,
          targetUrl: finalRedirectionUrl,
        }
      });
    } catch (dbErr) {
      console.error("[Redirect Analytics Error] Failed to log ReferralClick:", dbErr);
    }

    // 4. Temporary Redirect (307) to the affiliate link
    return NextResponse.redirect(finalRedirectionUrl, 307);
  } catch (error) {
    console.error(`[Redirect Exception] Error redirecting slug "${slug}" to store "${store}":`, error);
    return NextResponse.redirect(fallbackUrl || new URL("/", request.url).toString(), 307);
  }
}
