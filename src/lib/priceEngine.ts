import { db } from "./db";

const CHEAPSHARK_STORE_MAP: Record<string, string> = {
  "1": "Steam",
  "2": "GamersGate",
  "3": "GreenManGaming",
  "6": "Direct2Drive",
  "7": "GOG",
  "8": "Origin",
  "11": "Humble Store",
  "15": "Fanatical",
  "21": "Epic Games Store",
  "23": "GameBillet",
  "24": "Voidu",
  "25": "Epic Games Store",
  "27": "Gamesplanet",
  "28": "Gamesload",
  "29": "2Game",
  "30": "IndieGala",
  "31": "Blizzard Shop",
  "32": "AllYouPlay",
  "33": "DLGamer",
  "34": "Noctre",
  "35": "DreamGame"
};

// Global rate limit cooldown timers to bypass rate-limited APIs dynamically
let cheapSharkCoolDownUntil = 0;
let itadCoolDownUntil = 0;

export function extractSteamAppId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/i);
  return match ? match[1] : null;
}

export function normalizeStoreName(name: string): string {
  const n = name.toLowerCase().trim();
  if (n.includes("steam")) return "Steam";
  if (n.includes("gog")) return "GOG";
  if (n.includes("humble")) return "Humble Store";
  if (n.includes("fanatical")) return "Fanatical";
  if (n.includes("epic")) return "Epic Games Store";
  if (n.includes("greenman") || n.includes("green man")) return "GreenManGaming";
  if (n.includes("gamersgate")) return "GamersGate";
  if (n.includes("gamebillet")) return "GameBillet";
  if (n.includes("voidu")) return "Voidu";
  return name.trim();
}

export interface PriceDeal {
  storeName: string;
  dealPrice: number;
  retailPrice: number;
  discountPercent: number;
  dealUrl: string;
}

// Resilient fetch with exponential backoff and cooldown tracking for 429 rate limits
// Resilient fetch with exponential backoff and cooldown tracking for 429 rate limits
async function fetchWithBackoff(url: string, init?: RequestInit, retries = 3, delay = 1500): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5 seconds timeout limit

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      const cooldownPeriod = 5 * 60 * 1000; // 5 minutes cooldown
      if (url.includes("cheapshark.com")) {
        cheapSharkCoolDownUntil = Date.now() + cooldownPeriod;
        console.warn(`⚠️ CheapShark 429 detected. Cooldown active for 5 mins.`);
      } else if (url.includes("isthereanydeal.com")) {
        itadCoolDownUntil = Date.now() + cooldownPeriod;
        console.warn(`⚠️ IsThereAnyDeal 429 detected. Cooldown active for 5 mins.`);
      }

      if (retries > 0) {
        console.warn(`⚠️ Rate limited (429) on ${url}. Retrying in ${delay}ms... (${retries} left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithBackoff(url, init, retries - 1, delay * 2);
      }
    }
    
    if (!response.ok && response.status !== 429) {
      console.warn(`⚠️ Request to ${url} failed with status: ${response.status}`);
    }
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`⚠️ Request to ${url} timed out after 4500ms.`);
      throw new Error(`Timeout fetching from external source: ${url}`);
    }
    if (retries > 0) {
      console.warn(`⚠️ Network error requesting ${url}. Retrying in ${delay}ms... (${retries} left)`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithBackoff(url, init, retries - 1, delay * 2);
    }
    throw error;
  }
}

// 1. CheapShark Fetcher
export async function fetchCheapSharkDeals(steamId: string | null, title: string): Promise<PriceDeal[]> {
  if (Date.now() < cheapSharkCoolDownUntil) {
    // Under cooldown, skip CheapShark fetch to prevent rate limit stalling
    return [];
  }

  try {
    let cheapSharkGameId: string | null = null;

    if (steamId) {
      const response = await fetchWithBackoff(`https://www.cheapshark.com/api/1.0/games?steamAppID=${steamId}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          cheapSharkGameId = data[0].gameID;
        } else if (data && typeof data === "object" && !Array.isArray(data)) {
          const keys = Object.keys(data);
          if (keys.length > 0) {
            cheapSharkGameId = data[keys[0]].gameID;
          }
        }
      }
    }

    if (!cheapSharkGameId) {
      const response = await fetchWithBackoff(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(title.trim())}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          cheapSharkGameId = data[0].gameID;
        }
      }
    }

    if (!cheapSharkGameId) return [];

    const detailsResponse = await fetchWithBackoff(`https://www.cheapshark.com/api/1.0/games?id=${cheapSharkGameId}`);
    if (!detailsResponse.ok) return [];

    const detailsData = await detailsResponse.json();
    if (!detailsData || !Array.isArray(detailsData.deals)) return [];

    const deals: PriceDeal[] = detailsData.deals.map((deal: any) => {
      const dealPrice = parseFloat(deal.price);
      const retailPrice = parseFloat(deal.retailPrice);
      const discountPercent = parseFloat(deal.savings);
      const rawStore = CHEAPSHARK_STORE_MAP[deal.storeID] || `Store #${deal.storeID}`;
      const storeName = normalizeStoreName(rawStore);
      const dealUrl = `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`;

      return {
        storeName,
        dealPrice,
        retailPrice,
        discountPercent: Math.round(discountPercent),
        dealUrl,
      };
    });

    return deals;
  } catch (error) {
    console.warn(`[CheapShark Error] Failed fetching deals for "${title}":`, error);
    return [];
  }
}

// 2. IsThereAnyDeal Fetchers
async function fetchItadGameId(apiKey: string, steamId: string | null, title: string): Promise<string | null> {
  if (Date.now() < itadCoolDownUntil) return null;

  try {
    if (steamId) {
      const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${apiKey}&appid=${steamId}`;
      const res = await fetchWithBackoff(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.found && data.game) {
          return data.game.id;
        }
      }
    }

    const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${apiKey}&title=${encodeURIComponent(title.trim())}`;
    const res = await fetchWithBackoff(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.found && data.game) {
        return data.game.id;
      }
    }
  } catch (error) {
    console.warn(`[ITAD Lookup Error] Failed to find ITAD ID for "${title}":`, error);
  }
  return null;
}

async function fetchItadPrices(apiKey: string, itadId: string): Promise<PriceDeal[]> {
  if (Date.now() < itadCoolDownUntil) return [];

  try {
    const url = `https://api.isthereanydeal.com/games/prices/v3?key=${apiKey}&country=US&deals=true`;
    const res = await fetchWithBackoff(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([itadId])
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    const gameData = data.find((item: any) => item.id === itadId);
    if (!gameData || !Array.isArray(gameData.deals)) return [];

    const deals: PriceDeal[] = gameData.deals.map((deal: any) => {
      const dealPrice = deal.price?.amount || 0;
      const retailPrice = deal.regular?.amount || dealPrice;
      const cut = deal.cut || 0;
      const discountPercent = cut > 0 && cut <= 1 ? cut * 100 : cut;
      const storeName = normalizeStoreName(deal.shop?.name || "Unknown Store");
      const dealUrl = deal.url || "";

      return {
        storeName,
        dealPrice,
        retailPrice,
        discountPercent: Math.round(discountPercent),
        dealUrl
      };
    });

    return deals;
  } catch (error) {
    console.warn(`[ITAD Prices Error] Failed loading prices for ITAD ID ${itadId}:`, error);
    return [];
  }
}

// 3. Dynamic Aggregated Fetcher
export async function fetchAggregatedDeals(steamId: string | null, title: string): Promise<PriceDeal[]> {
  const itadApiKey = process.env.ITAD_API_KEY;

  const fetchPromises: Promise<PriceDeal[]>[] = [
    fetchCheapSharkDeals(steamId, title)
  ];

  if (itadApiKey) {
    const itadIdPromise = fetchItadGameId(itadApiKey, steamId, title).then((itadId) => {
      if (itadId) {
        return fetchItadPrices(itadApiKey, itadId);
      }
      return [];
    });
    fetchPromises.push(itadIdPromise);
  }

  const results = await Promise.allSettled(fetchPromises);
  const allDeals: PriceDeal[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allDeals.push(...result.value);
    }
  }

  // Deduplicate and aggregate keeping only the cheapest price per storeName
  const mergedDealsMap = new Map<string, PriceDeal>();

  for (const deal of allDeals) {
    const existing = mergedDealsMap.get(deal.storeName);
    if (!existing || deal.dealPrice < existing.dealPrice) {
      mergedDealsMap.set(deal.storeName, deal);
    }
  }

  const sortedDeals = Array.from(mergedDealsMap.values()).sort((a, b) => a.dealPrice - b.dealPrice);
  return sortedDeals;
}

// 4. Lazy Cache Getter
export async function lazyGetPrices(
  gameId: string,
  title: string,
  purchaseLinks: { storeName: string; url: string }[]
): Promise<PriceDeal[]> {
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  try {
    // A. Check database cache
    const cached = await db.priceSnapshot.findMany({
      where: { gameId },
      orderBy: { dealPrice: "asc" }
    });

    // Bypass API calls during production pre-render to avoid build limits
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return cached.map(c => ({
        storeName: c.storeName,
        dealPrice: c.dealPrice,
        retailPrice: c.retailPrice,
        discountPercent: c.discountPercent,
        dealUrl: c.dealUrl
      }));
    }

    if (cached.length > 0) {
      const oldestUpdate = Math.min(...cached.map(c => c.updatedAt.getTime()));
      const isFresh = (Date.now() - oldestUpdate) < CACHE_TTL_MS;

      if (isFresh) {
        return cached.map(c => ({
          storeName: c.storeName,
          dealPrice: c.dealPrice,
          retailPrice: c.retailPrice,
          discountPercent: c.discountPercent,
          dealUrl: c.dealUrl
        }));
      }
    }

    // B. Cache stale/missing: Find steamId
    let steamId: string | null = null;
    for (const link of purchaseLinks) {
      const id = extractSteamAppId(link.url);
      if (id) {
        steamId = id;
        break;
      }
    }

    // C. Fetch aggregated deals
    const freshDeals = await fetchAggregatedDeals(steamId, title);

    if (freshDeals.length > 0) {
      // D. Transaction to update local cached data
      await db.$transaction([
        db.priceSnapshot.deleteMany({ where: { gameId } }),
        db.priceSnapshot.createMany({
          data: freshDeals.map(deal => ({
            gameId,
            storeName: deal.storeName,
            dealPrice: deal.dealPrice,
            retailPrice: deal.retailPrice,
            discountPercent: deal.discountPercent,
            dealUrl: deal.dealUrl,
            updatedAt: new Date()
          }))
        })
      ]);
      return freshDeals;
    } else if (cached.length > 0) {
      // Fall back to stale cache if API failed/returned empty
      return cached.map(c => ({
        storeName: c.storeName,
        dealPrice: c.dealPrice,
        retailPrice: c.retailPrice,
        discountPercent: c.discountPercent,
        dealUrl: c.dealUrl
      }));
    }

    return [];
  } catch (error) {
    console.error(`Error in lazyGetPrices for Game ID ${gameId}:`, error);
    return [];
  }
}
