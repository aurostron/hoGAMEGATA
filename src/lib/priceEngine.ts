import { turso } from "./turso";
import { games as gamesTable, priceSnapshots as priceSnapshotsTable, purchaseLinks as purchaseLinksTable } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { fetchItchDataJson } from "./itchParser";

const CHEAPSHARK_STORE_MAP: Record<string, string> = {
  "1": "Steam",
  "2": "GamersGate",
  "3": "Green Man Gaming",
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
  if (n.includes("gog") || n.includes("good old games")) return "GOG";
  if (n.includes("humble")) return "Humble Store";
  if (n.includes("fanatical")) return "Fanatical";
  if (n.includes("epic")) return "Epic Games Store";
  if (n.includes("greenman") || n.includes("green man") || n.includes("gmg")) return "Green Man Gaming";
  if (n.includes("microsoft") || n.includes("xbox") || n.includes("ms store")) return "Microsoft Store";
  if (n.includes("gamebillet")) return "GameBillet";
  if (n.includes("gamesplanet")) return "Gamesplanet";
  if (n.includes("gamersgate")) return "GamersGate";
  if (n.includes("indiegala")) return "IndieGala";
  if (n.includes("voidu")) return "Voidu";
  if (n.includes("2game")) return "2Game";
  if (n.includes("dlgamer")) return "DLGamer";
  if (n.includes("wingamestore")) return "WinGameStore";
  if (n.includes("etail")) return "eTail.Market";
  if (n.includes("joybuggy")) return "JoyBuggy";
  if (n.includes("itch")) return "itch.io";
  return name.trim();
}

export function buildCleanStoreUrl(
  storeName: string,
  title: string,
  steamAppId?: string | null,
  gogSlugOrUrl?: string | null
): string {
  const cleanTitle = title.trim();
  const kebabSlug = cleanTitle
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const normStore = normalizeStoreName(storeName);

  switch (normStore) {
    case "Steam":
      if (steamAppId) {
        return `https://store.steampowered.com/app/${steamAppId}/`;
      }
      return `https://store.steampowered.com/search/?term=${encodeURIComponent(cleanTitle)}`;

    case "GOG": {
      if (gogSlugOrUrl) {
        let slug = gogSlugOrUrl;
        const match = gogSlugOrUrl.match(/gog\.com\/(?:[a-z]{2}\/)?game\/([^/?#]+)/i);
        if (match) slug = match[1];
        return `https://www.gog.com/en/game/${slug}`;
      }
      return `https://www.gog.com/en/game/${kebabSlug}`;
    }

    case "Fanatical":
      return `https://www.fanatical.com/en/game/${kebabSlug}`;

    case "Green Man Gaming":
      return `https://www.greenmangaming.com/games/${kebabSlug}-pc/`;

    case "Humble Store":
      return `https://www.humblebundle.com/store/${kebabSlug}`;

    case "Microsoft Store":
      return `https://www.xbox.com/en-us/search?q=${encodeURIComponent(cleanTitle)}`;

    case "Epic Games Store":
      return `https://store.epicgames.com/en-US/p/${kebabSlug}`;

    case "GameBillet":
      return `https://www.gamebillet.com/${kebabSlug}`;

    case "Gamesplanet":
      return `https://us.gamesplanet.com/game/${kebabSlug}`;

    case "GamersGate":
      return `https://www.gamersgate.com/product/${kebabSlug}/`;

    case "IndieGala":
      return `https://www.indiegala.com/store/game/${kebabSlug}`;

    case "Voidu":
      return `https://www.voidu.com/en/${kebabSlug}`;

    case "2Game":
      return `https://2game.com/en-us/${kebabSlug}`;

    case "DLGamer":
      return `https://www.dlgamer.com/us/games/buy-${kebabSlug}`;

    case "WinGameStore":
      return `https://www.wingamestore.com/product/${kebabSlug}`;

    case "eTail.Market":
      return `https://etail.market/${kebabSlug}`;

    case "JoyBuggy":
      return `https://www.joybuggy.com/en/${kebabSlug}`;

    case "Newegg":
      return `https://www.newegg.com/p/pl?d=${encodeURIComponent(cleanTitle)}`;

    case "itch.io":
      return `https://itch.io/search?q=${encodeURIComponent(cleanTitle)}`;

    default:
      return `https://store.steampowered.com/search/?term=${encodeURIComponent(cleanTitle)}`;
  }
}

export interface PriceDeal {
  storeName: string;
  dealPrice: number;
  retailPrice: number;
  discountPercent: number;
  dealUrl: string;
  currency: string;
}

// Resilient fetch with exponential backoff and cooldown tracking for 429 rate limits
async function fetchWithBackoff(url: string, init?: RequestInit, retries = 3, delay = 1500): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5 seconds timeout limit

  try {
    const headers = new Headers(init?.headers);
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", "hoGAMEGATA-Price-Engine/1.0 (contact@gamegata.xyz)");
    }
    const response = await fetch(url, {
      ...init,
      headers,
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
      const response = await fetchWithBackoff(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(title.trim()).replace(/'/g, "%27")}&limit=1`);
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
        currency: "USD"
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

async function fetchItadPrices(apiKey: string, itadId: string, country: string): Promise<PriceDeal[]> {
  if (Date.now() < itadCoolDownUntil) return [];

  try {
    const url = `https://api.isthereanydeal.com/games/prices/v3?key=${apiKey}&country=${country}`;
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
      const currency = deal.price?.currency || "USD";

      return {
        storeName,
        dealPrice,
        retailPrice,
        discountPercent: Math.round(discountPercent),
        dealUrl,
        currency
      };
    });

    return deals;
  } catch (error) {
    console.warn(`[ITAD Prices Error] Failed loading prices for ITAD ID ${itadId}:`, error);
    return [];
  }
}

// 3. Dynamic Aggregated Fetcher
export async function fetchAggregatedDeals(steamId: string | null, title: string, country: string = "US"): Promise<PriceDeal[]> {
  const itadApiKey = import.meta.env?.ITAD_API_KEY || process.env.ITAD_API_KEY;
  const upperCountry = (country || "US").toUpperCase();

  const fetchPromises: Promise<PriceDeal[]>[] = [];

  if (upperCountry === "US") {
    fetchPromises.push(fetchCheapSharkDeals(steamId, title));
  }

  if (itadApiKey) {
    const itadIdPromise = fetchItadGameId(itadApiKey, steamId, title).then((itadId) => {
      if (itadId) {
        return fetchItadPrices(itadApiKey, itadId, upperCountry);
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

// 4. Direct Steam & GOG Storefront Fetchers
export async function fetchSteamDirect(
  steamAppId: string | null,
  title: string,
  gameId: string,
  hasSteamLink: boolean = false,
  country: string = "US"
): Promise<PriceDeal[]> {
  try {
    let resolvedAppId = steamAppId;
    let resolvedFromSearch = false;

    // 1. If App ID is missing, query Steam's Storesearch API
    if (!resolvedAppId) {
      const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title.trim())}&l=english&cc=${country.toLowerCase()}`;
      const response = await fetchWithBackoff(searchUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          // Find item that matches the title
          const match = data.items.find((item: any) => {
            const pName = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            const dTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
            return pName === dTitle || pName.includes(dTitle) || dTitle.includes(pName);
          });

          if (match && match.id) {
            resolvedAppId = String(match.id);
            resolvedFromSearch = true;
          }
        }
      }
    }

    if (!resolvedAppId) return [];

    // 2. Query Steam Storefront API using the App ID and active country
    const url = `https://store.steampowered.com/api/appdetails?appids=${resolvedAppId}&cc=${country.toLowerCase()}&filters=price_overview`;
    const response = await fetchWithBackoff(url);
    if (!response.ok) return [];

    const data = await response.json();
    if (data && data[resolvedAppId] && data[resolvedAppId].success && data[resolvedAppId].data) {
      const dataObj = data[resolvedAppId].data;
      if (dataObj.price_overview) {
        const priceInfo = dataObj.price_overview;
        const dealPrice = priceInfo.final / 100;
        const retailPrice = priceInfo.initial / 100;
        const discountPercent = priceInfo.discount_percent;

        // 3. Asynchronously cache the resolved Steam App ID in the PurchaseLink table ONLY if Steam link already exists
        if (resolvedFromSearch && hasSteamLink) {
          const steamUrl = `https://store.steampowered.com/app/${resolvedAppId}/`;
          turso
            .update(purchaseLinksTable)
            .set({ url: steamUrl })
            .where(
              and(
                eq(purchaseLinksTable.gameId, gameId),
                eq(purchaseLinksTable.storeName, "Steam")
              )
            )
            .then(() => console.log(`✓ Updated Steam link in DB for game ${gameId} with AppID ${resolvedAppId}`))
            .catch((err) => console.warn(`⚠️ Failed to update Steam link in DB:`, err));
        }

        return [{
          storeName: "Steam",
          dealPrice,
          retailPrice,
          discountPercent: Math.round(discountPercent),
          dealUrl: `https://store.steampowered.com/app/${resolvedAppId}/`,
          currency: priceInfo.currency || "USD"
        }];
      }
    }
  } catch (error) {
    console.warn(`[Steam Direct Error] Failed fetching direct pricing for Steam "${title}":`, error);
  }
  return [];
}

export async function fetchGogDirect(
  title: string,
  cleanGogUrl: string,
  gameId: string,
  country: string = "US"
): Promise<PriceDeal[]> {
  try {
    // 1. Extract GOG product ID if already cached in GOG URL (e.g. ?gogId=123)
    const cachedIdMatch = cleanGogUrl.match(/gogId=(\d+)/i);
    let gogProductId = cachedIdMatch ? cachedIdMatch[1] : null;

    let targetGogUrl = cleanGogUrl;
    let resolvedFromCatalog = false;

    // 2. If GOG Product ID is not cached, search catalog API by URL slug to resolve ID
    if (!gogProductId) {
      const slugMatch = cleanGogUrl.match(/\/game\/([a-z0-9_]+)/i);
      const gogSlug = slugMatch ? slugMatch[1] : null;
      if (!gogSlug) return [];

      const catalogUrl = `https://catalog.gog.com/v1/catalog?order=desc:popularity&limit=20&query=like:${encodeURIComponent(gogSlug)}`;
      const response = await fetchWithBackoff(catalogUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.products) && data.products.length > 0) {
          // 1. Try exact slug match first
          let product = data.products.find((p: any) => p.slug.toLowerCase() === gogSlug.toLowerCase());

          // 2. Fall back to normalized slug match
          if (!product) {
            product = data.products.find((p: any) => {
              const pSlug = p.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
              const dSlug = gogSlug.toLowerCase().replace(/[^a-z0-9]/g, "");
              return pSlug === dSlug;
            });
          }

          // 3. Fall back to title match, strictly avoiding demo/dlc/soundtracks if the search title does not have them
          if (!product) {
            product = data.products.find((p: any) => {
              const pTitle = p.title.toLowerCase();
              const dTitle = title.toLowerCase();
              if (pTitle.includes("demo") && !dTitle.includes("demo")) return false;
              if (pTitle.includes("soundtrack") && !dTitle.includes("soundtrack")) return false;
              if (pTitle.includes("dlc") && !dTitle.includes("dlc")) return false;
              return pTitle === dTitle || pTitle.includes(dTitle) || dTitle.includes(pTitle);
            });
          }

          if (product && product.id) {
            gogProductId = product.id;
            targetGogUrl = product.storeLink || cleanGogUrl;
            resolvedFromCatalog = true;
          }
        }
      }
    }

    if (!gogProductId) return [];

    // 3. Query GOG's official direct Product Price API
    const priceUrl = `https://api.gog.com/products/${gogProductId}/prices?countryCode=${country.toUpperCase()}`;
    const priceRes = await fetchWithBackoff(priceUrl);
    if (!priceRes.ok) return [];

    const priceData = await priceRes.json();
    if (priceData && priceData._embedded && Array.isArray(priceData._embedded.prices) && priceData._embedded.prices.length > 0) {
      const priceObj = priceData._embedded.prices[0];
      const finalPrice = parseFloat(priceObj.finalPrice.replace(/[^0-9]/g, "")) / 100;
      const basePrice = parseFloat(priceObj.basePrice.replace(/[^0-9]/g, "")) / 100;
      const currency = priceObj.currency?.code || "USD";

      let discountPercent = 0;
      if (basePrice > 0) {
        discountPercent = Math.round(((basePrice - finalPrice) / basePrice) * 100);
      }

      // 4. Asynchronously cache the resolved GOG ID in the database to avoid future catalog lookups
      if (resolvedFromCatalog) {
        const updatedUrl = cleanGogUrl.includes("?")
          ? `${cleanGogUrl}&gogId=${gogProductId}`
          : `${cleanGogUrl}?gogId=${gogProductId}`;

        turso
          .update(purchaseLinksTable)
          .set({ url: updatedUrl })
          .where(
            and(
              eq(purchaseLinksTable.gameId, gameId),
              eq(purchaseLinksTable.storeName, "GOG")
            )
          )
          .then(() => console.log(`✓ Cached GOG ID ${gogProductId} in PurchaseLink for game ${gameId}`))
          .catch((err) => console.warn(`⚠️ Failed to cache GOG ID in DB:`, err));
      }

      return [{
        storeName: "GOG",
        dealPrice: finalPrice,
        retailPrice: basePrice,
        discountPercent: Math.max(0, discountPercent),
        dealUrl: targetGogUrl,
        currency
      }];
    }
  } catch (error) {
    console.warn(`[GOG Direct API Error] Failed direct GOG fetch for "${title}":`, error);
  }
  return [];
}

export async function fetchDirectDeals(
  steamId: string | null,
  gogUrl: string | null,
  title: string,
  gameId: string,
  hasSteamLink: boolean = false,
  country: string = "US"
): Promise<PriceDeal[]> {
  const upperCountry = (country || "US").toUpperCase();
  
  console.log(`[fetchDirectDeals] 🔍 Starting for "${title}" | steamId=${steamId} | gogUrl=${gogUrl} | country=${upperCountry}`);

  // 1. Concurrently run direct scanners (Steam, GOG) and multi-source deal feeds (ITAD v3, CheapShark)
  const [directSteamResult, directGogResult, aggregatedResult] = await Promise.allSettled([
    fetchSteamDirect(steamId, title, gameId, hasSteamLink, upperCountry),
    gogUrl ? fetchGogDirect(title, gogUrl, gameId, upperCountry) : Promise.resolve([]),
    fetchAggregatedDeals(steamId, title, upperCountry)
  ]);

  const directSteamDeals = directSteamResult.status === "fulfilled" ? directSteamResult.value : [];
  const directGogDeals = directGogResult.status === "fulfilled" ? directGogResult.value : [];
  const aggregatedDeals = aggregatedResult.status === "fulfilled" ? aggregatedResult.value : [];

  console.log(`[fetchDirectDeals] Steam direct: ${directSteamDeals.length} deals | GOG direct: ${directGogDeals.length} deals | Aggregated: ${aggregatedDeals.length} deals`);
  if (directSteamResult.status === "rejected") console.warn(`[fetchDirectDeals] ❌ Steam direct REJECTED:`, directSteamResult.reason);
  if (directGogResult.status === "rejected") console.warn(`[fetchDirectDeals] ❌ GOG direct REJECTED:`, directGogResult.reason);
  if (aggregatedResult.status === "rejected") console.warn(`[fetchDirectDeals] ❌ Aggregated REJECTED:`, aggregatedResult.reason);
  if (aggregatedDeals.length > 0) {
    console.log(`[fetchDirectDeals] Aggregated stores:`, aggregatedDeals.map(d => `${d.storeName}: $${d.dealPrice}`).join(', '));
  }

  // Extract resolved Steam App ID if available
  let resolvedSteamId = steamId;
  if (!resolvedSteamId && directSteamDeals.length > 0) {
    const linkMatch = directSteamDeals[0].dealUrl.match(/\/app\/(\d+)/);
    if (linkMatch) resolvedSteamId = linkMatch[1];
  }

  // 2. Map & Deduplicate across major authorized stores
  const storeDealMap = new Map<string, PriceDeal>();

  // A. Priority 1: Direct official store scans for Steam & GOG (highest accuracy for live regional currency)
  for (const deal of directSteamDeals) {
    storeDealMap.set("Steam", {
      ...deal,
      dealUrl: buildCleanStoreUrl("Steam", title, resolvedSteamId, gogUrl)
    });
  }

  for (const deal of directGogDeals) {
    storeDealMap.set("GOG", {
      ...deal,
      dealUrl: buildCleanStoreUrl("GOG", title, resolvedSteamId, gogUrl)
    });
  }

  // B. Priority 2: Ingest other authorized digital stores from multi-source deal feeds (Epic, Fanatical, GMG, Humble, MS Store, GameBillet, etc.)
  for (const deal of aggregatedDeals) {
    const normStore = normalizeStoreName(deal.storeName);
    if (!normStore) continue;

    const cleanUrl = buildCleanStoreUrl(normStore, title, resolvedSteamId, gogUrl);
    const existing = storeDealMap.get(normStore);

    if (!existing) {
      // Store doesn't exist yet, add from deal feed with clean URL
      storeDealMap.set(normStore, {
        ...deal,
        storeName: normStore,
        dealUrl: cleanUrl
      });
    } else {
      // If store already exists (e.g. from direct scan), only replace if feed has a cheaper valid deal in same currency
      if (deal.dealPrice > 0 && deal.dealPrice < existing.dealPrice && existing.dealPrice > 0) {
        if (deal.currency === existing.currency) {
          storeDealMap.set(normStore, {
            ...deal,
            storeName: normStore,
            dealUrl: cleanUrl
          });
        }
      }
    }
  }

  // 3. Compile all deals into a unified array
  const compiledDeals = Array.from(storeDealMap.values());

  // 4. Sort by deal price ascending (cheapest deal on top)
  compiledDeals.sort((a, b) => {
    if (a.dealPrice !== b.dealPrice) {
      return a.dealPrice - b.dealPrice;
    }
    // Deterministic tie-breaker
    return a.storeName.localeCompare(b.storeName);
  });

  console.log(`[fetchDirectDeals] ✅ Final compiled: ${compiledDeals.length} deals:`, compiledDeals.map(d => `${d.storeName}: $${d.dealPrice}`).join(', '));

  return compiledDeals;
}

// Safe ID generator for PriceSnapshot client-side inserts (as id field is not generated at DB level)
const generatePriceSnapshotId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// 5. Lazy Cache Getter using direct Supabase queries
export async function lazyGetPrices(
  gameId: string,
  title: string,
  purchaseLinks: { storeName: string; url: string }[],
  country: string = "US",
  forceRefresh: boolean = false,
  provider: string = "direct"
): Promise<PriceDeal[]> {
  const upperCountry = (country || "US").toUpperCase();
  const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours smart cache window

  try {
    // Detect if this is strictly an itch.io game
    const hasItchStore = purchaseLinks.some(l => 
      l.storeName?.toLowerCase().includes("itch") || l.url?.includes("itch.io")
    );
    const hasNonItchStore = purchaseLinks.some(l => 
      !l.storeName?.toLowerCase().includes("itch") && !l.url?.includes("itch.io")
    );
    
    let isItchGame = hasItchStore && !hasNonItchStore;
    if (!isItchGame && gameId) {
      try {
        const [gRow] = await turso
          .select({ slug: gamesTable.slug })
          .from(gamesTable)
          .where(eq(gamesTable.id, gameId))
          .limit(1);
        if (gRow?.slug?.startsWith("itch-")) {
          isItchGame = true;
        }
      } catch {}
    }

    // A. Check database cache in Turso
    const cached = await turso
      .select()
      .from(priceSnapshotsTable)
      .where(
        and(
          eq(priceSnapshotsTable.gameId, gameId),
          eq(priceSnapshotsTable.country, upperCountry),
          eq(priceSnapshotsTable.provider, provider)
        )
      )
      .orderBy(priceSnapshotsTable.dealPrice);

    // Strict itch.io game isolation: ONLY itch.io pricing, ZERO Steam/GOG/Aggregator calls
    if (isItchGame) {
      const itchLink = purchaseLinks.find(l => 
        l.storeName?.toLowerCase().includes("itch") || l.url?.includes("itch.io")
      );
      const targetItchUrl = itchLink?.url || null;

      const cachedItch = cached.filter(c => 
        c.storeName?.toLowerCase().includes("itch") || c.dealUrl?.includes("itch.io") || c.provider === "itch"
      );

      if (cachedItch.length > 0 && !forceRefresh) {
        const oldestUpdate = Math.min(...cachedItch.map(c => new Date(c.updatedAt).getTime()));
        const isFresh = (Date.now() - oldestUpdate) < CACHE_TTL_MS;
        if (isFresh) {
          return cachedItch.map(c => ({
            storeName: "itch.io",
            dealPrice: c.dealPrice,
            retailPrice: c.retailPrice,
            discountPercent: c.discountPercent,
            dealUrl: c.dealUrl,
            currency: c.currency
          }));
        }
      }

      if (targetItchUrl) {
        try {
          const itchData = await fetchItchDataJson(targetItchUrl);
          if (itchData.success) {
            const dealP = itchData.price ?? 0;
            const retP = itchData.originalPrice ?? dealP;
            const discP = itchData.discountPercent ?? 0;
            const cleanItchUrl = targetItchUrl.replace(/\/purchase$/, "").replace(/\/+$/, "");

            const finalItchDeal: PriceDeal = {
              storeName: "itch.io",
              dealPrice: dealP,
              retailPrice: retP,
              discountPercent: discP,
              dealUrl: cleanItchUrl,
              currency: itchData.currency || "USD"
            };

            // Wipe any rogue non-itch snapshots and write clean itch snapshot
            try {
              await turso
                .delete(priceSnapshotsTable)
                .where(eq(priceSnapshotsTable.gameId, gameId));
              await turso
                .insert(priceSnapshotsTable)
                .values({
                  id: generatePriceSnapshotId(),
                  gameId,
                  storeName: "itch.io",
                  dealPrice: dealP,
                  retailPrice: retP,
                  discountPercent: discP,
                  dealUrl: cleanItchUrl,
                  currency: itchData.currency || "USD",
                  country: upperCountry,
                  provider: "direct",
                  updatedAt: new Date()
                });
            } catch (dbErr) {
              console.warn("⚠️ Failed to write itch price snapshot to Turso:", dbErr);
            }

            return [finalItchDeal];
          }
        } catch (err) {
          console.warn(`[Pricing Engine] Failed to fetch live itch deal for "${title}":`, err);
        }
      }

      if (cachedItch.length > 0) {
        return cachedItch.map(c => ({
          storeName: "itch.io",
          dealPrice: c.dealPrice,
          retailPrice: c.retailPrice,
          discountPercent: c.discountPercent,
          dealUrl: c.dealUrl,
          currency: c.currency
        }));
      }

      if (targetItchUrl) {
        return [{
          storeName: "itch.io",
          dealPrice: 0,
          retailPrice: 0,
          discountPercent: 0,
          dealUrl: targetItchUrl.replace(/\/purchase$/, "").replace(/\/+$/, ""),
          currency: "USD"
        }];
      }

      return [];
    }

    if (cached.length > 0 && !forceRefresh) {
      const oldestUpdate = Math.min(...cached.map(c => new Date(c.updatedAt).getTime()));
      const isFresh = (Date.now() - oldestUpdate) < CACHE_TTL_MS;

      // Check if cache has expanded multi-store deals beyond just Steam/GOG
      const hasExpandedStores = cached.some(c => c.storeName !== "Steam" && c.storeName !== "GOG");

      // Only reuse cache if it is fresh AND has expanded store coverage (or aggregated feed)
      if (isFresh && (hasExpandedStores || provider === "aggregated")) {
        return cached.map(c => ({
          storeName: c.storeName,
          dealPrice: c.dealPrice,
          retailPrice: c.retailPrice,
          discountPercent: c.discountPercent,
          dealUrl: c.dealUrl,
          currency: c.currency
        }));
      }
    }

    if (forceRefresh) {
      console.log(`[Pricing Engine] 🔥 Strict On-Demand Refresh initiated for "${title}" (${provider}) in region ${upperCountry}`);
    }

    // B. Cache stale/missing: Find steamId, gogUrl & itchUrl
    let steamId: string | null = null;
    let hasSteamLink = false;
    let gogUrl: string | null = null;
    let itchUrl: string | null = null;
    for (const link of purchaseLinks) {
      const sName = link.storeName?.toLowerCase() || "";
      if (sName === "steam") {
        hasSteamLink = true;
        const id = extractSteamAppId(link.url);
        if (id) steamId = id;
      } else if (sName === "gog") {
        gogUrl = link.url;
      } else if (sName.includes("itch") || (link.url && link.url.includes("itch.io"))) {
        itchUrl = link.url;
      }
    }

    // C. Fetch fresh deals based on provider
    let freshDeals = provider === "direct"
      ? await fetchDirectDeals(steamId, gogUrl, title, gameId, hasSteamLink, upperCountry)
      : await fetchAggregatedDeals(steamId, title, upperCountry);

    // Fetch itch.io real-time deal via lightweight data.json if itch link exists
    let itchDeal: PriceDeal | null = null;
    if (itchUrl) {
      try {
        const itchData = await fetchItchDataJson(itchUrl);
        if (itchData.success) {
          const dealP = itchData.price ?? 0;
          const retP = itchData.originalPrice ?? dealP;
          const discP = itchData.discountPercent ?? 0;
          const cleanItchUrl = itchUrl.replace(/\/purchase$/, "").replace(/\/+$/, "");

          itchDeal = {
            storeName: "itch.io",
            dealPrice: dealP,
            retailPrice: retP,
            discountPercent: discP,
            dealUrl: cleanItchUrl,
            currency: itchData.currency || "USD"
          };

          // If coverUrl is provided by data.json and game in Turso is missing a cover, backfill it!
          if (itchData.coverUrl && gameId) {
            try {
              turso
                .select({ coverUrl: gamesTable.coverUrl })
                .from(gamesTable)
                .where(eq(gamesTable.id, gameId))
                .limit(1)
                .then((rows) => {
                  if (rows.length > 0 && !rows[0].coverUrl) {
                    turso
                      .update(gamesTable)
                      .set({ coverUrl: itchData.coverUrl })
                      .where(eq(gamesTable.id, gameId))
                      .then(() =>
                        console.log(
                          `[Pricing Engine] 🖼️ Backfilled missing coverUrl for game ${gameId} from itch data.json`
                        )
                      )
                      .catch((e) =>
                        console.error("[Pricing Engine] Failed to backfill cover:", e)
                      );
                  }
                })
                .catch(() => {});
            } catch {}
          }
        }
      } catch (err) {
        console.warn(`[Pricing Engine] Failed to fetch itch data.json for "${title}":`, err);
      }
    }

    if (itchDeal) {
      freshDeals = freshDeals.filter(d => d.storeName !== "itch.io");
      freshDeals.push(itchDeal);
    }

    console.log(`[Pricing Engine] ✅ Fetched ${freshDeals.length} deals for "${title}" (${provider}):`, freshDeals.map(d => `${d.storeName}: $${d.dealPrice}`).join(', '));

    // D. Rate-limit resilience: if provider="direct" but we only got Steam/GOG
    //    (aggregated APIs were rate-limited), supplement with DB-cached aggregated deals
    if (provider === "direct") {
      const hasExpandedFresh = freshDeals.some(d => d.storeName !== "Steam" && d.storeName !== "GOG");
      if (!hasExpandedFresh && freshDeals.length > 0) {
        console.log(`[Pricing Engine] ⚠️ Direct fetch returned only Steam/GOG — checking DB for cached aggregated deals to supplement`);
        try {
          const aggregatedCache = await turso
            .select()
            .from(priceSnapshotsTable)
            .where(
              and(
                eq(priceSnapshotsTable.gameId, gameId),
                eq(priceSnapshotsTable.country, upperCountry),
                eq(priceSnapshotsTable.provider, "aggregated")
              )
            )
            .orderBy(priceSnapshotsTable.dealPrice);

          if (aggregatedCache.length > 0) {
            console.log(`[Pricing Engine] 🔄 Found ${aggregatedCache.length} cached aggregated deals — merging with clean URLs`);
            const directDealMap = new Map<string, PriceDeal>();
            for (const d of freshDeals) {
              directDealMap.set(d.storeName, d);
            }

            for (const aggDeal of aggregatedCache) {
              const normStore = normalizeStoreName(aggDeal.storeName);
              if (!normStore || directDealMap.has(normStore)) continue;

              const cleanUrl = buildCleanStoreUrl(normStore, title, steamId, gogUrl);
              directDealMap.set(normStore, {
                storeName: normStore,
                dealPrice: aggDeal.dealPrice,
                retailPrice: aggDeal.retailPrice,
                discountPercent: aggDeal.discountPercent,
                dealUrl: cleanUrl,
                currency: aggDeal.currency
              });
            }

            freshDeals = Array.from(directDealMap.values()).sort((a, b) => {
              if (a.dealPrice !== b.dealPrice) return a.dealPrice - b.dealPrice;
              return a.storeName.localeCompare(b.storeName);
            });
            console.log(`[Pricing Engine] ✅ Merged result: ${freshDeals.length} deals:`, freshDeals.map(d => `${d.storeName}: $${d.dealPrice}`).join(', '));
          }
        } catch (mergeErr) {
          console.warn("[Pricing Engine] ⚠️ Failed to read aggregated cache for merge:", mergeErr);
        }
      }
    }

    if (freshDeals.length > 0) {
      // E. Update local cached data in Turso (Delete stale, then Insert fresh)
      // Only write to DB if we have expanded stores (don't overwrite good cache with degraded data)
      const hasExpandedResult = freshDeals.some(d => d.storeName !== "Steam" && d.storeName !== "GOG");
      if (hasExpandedResult || provider === "aggregated" || Boolean(itchDeal)) {
        try {
          await turso
            .delete(priceSnapshotsTable)
            .where(
              and(
                eq(priceSnapshotsTable.gameId, gameId),
                eq(priceSnapshotsTable.country, upperCountry),
                eq(priceSnapshotsTable.provider, provider)
              )
            );
        } catch (deleteError) {
          console.warn("⚠️ Failed to delete stale prices from Turso:", deleteError);
        }

        try {
          await turso
            .insert(priceSnapshotsTable)
            .values(
              freshDeals.map(deal => {
                let normDealPrice = deal.dealPrice;
                let normRetailPrice = deal.retailPrice;
                let normCurrency = deal.currency || "USD";

                if (normCurrency === "INR") {
                  normDealPrice = Math.round((normDealPrice / 83.5) * 100) / 100;
                  normRetailPrice = Math.round((normRetailPrice / 83.5) * 100) / 100;
                  normCurrency = "USD";
                }

                return {
                  id: generatePriceSnapshotId(),
                  gameId,
                  storeName: deal.storeName,
                  dealPrice: normDealPrice,
                  retailPrice: normRetailPrice,
                  discountPercent: deal.discountPercent,
                  dealUrl: deal.dealUrl,
                  currency: normCurrency,
                  country: upperCountry,
                  provider,
                  updatedAt: new Date()
                };
              })
            );
        } catch (insertError) {
          console.warn("⚠️ Failed to write fresh prices to Turso:", insertError);
        }
      } else {
        console.log(`[Pricing Engine] ⏭️ Skipping DB write — only Steam/GOG in result, preserving existing cache`);
      }

      return freshDeals;
    } else if (cached.length > 0) {
      // Fall back to stale cache if API failed/returned empty
      return cached.map(c => ({
        storeName: c.storeName,
        dealPrice: c.dealPrice,
        retailPrice: c.retailPrice,
        discountPercent: c.discountPercent,
        dealUrl: c.dealUrl,
        currency: c.currency
      }));
    }

    return [];
  } catch (error) {
    console.error(`Error in lazyGetPrices for Game ID ${gameId}:`, error);
    return [];
  }
}
