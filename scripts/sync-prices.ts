import "./load-env";
import { fetchAggregatedDeals, extractSteamAppId } from "../src/lib/priceEngine";
import {
  turso,
  schema,
  eq,
  and,
  desc,
  inArray,
  generateId
} from "./db-helper";

async function syncGamePrices(game: any, purchaseLinks: any[]): Promise<any[] | null> {
  let steamId: string | null = null;
  for (const link of purchaseLinks) {
    const id = extractSteamAppId(link.url);
    if (id) {
      steamId = id;
      break;
    }
  }

  try {
    const freshDeals = await fetchAggregatedDeals(steamId, game.title);

    if (freshDeals.length > 0) {
      const cheapest = freshDeals.reduce((min: any, d: any) => d.dealPrice < min.dealPrice ? d : min, freshDeals[0]);
      console.log(`✅ [Synced] ${game.title} - ${freshDeals.length} deals (Cheapest: $${cheapest.dealPrice} at ${cheapest.storeName})`);
      return freshDeals.map(deal => ({
        id: generateId(),
        gameId: game.id,
        storeName: deal.storeName,
        dealPrice: deal.dealPrice,
        retailPrice: deal.retailPrice,
        discountPercent: deal.discountPercent,
        dealUrl: deal.dealUrl,
        country: "US",
        updatedAt: new Date(),
      }));
    } else {
      console.log(`ℹ️ [No Deals Mapped] ${game.title}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ [Error] Failed syncing ${game.title}:`, error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 100;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      limit = parsedLimit;
    }
  }

  console.log(`🚀 Starting Dynamic Price Comparison Sync Warmer (CheapShark + ITAD) with limit: ${limit}...`);
  const startTime = Date.now();

  const games = await turso
    .select({ id: schema.games.id, title: schema.games.title })
    .from(schema.games)
    .orderBy(desc(schema.games.popularity))
    .limit(limit);

  console.log(`Fetched ${games.length} games to sync.`);

  const CONCURRENCY = 10;
  let syncedCount = 0;

  for (let i = 0; i < games.length; i += CONCURRENCY) {
    const chunk = games.slice(i, i + CONCURRENCY);
    const gameIds = chunk.map(g => g.id);

    const allLinks = await turso
      .select()
      .from(schema.purchaseLinks)
      .where(inArray(schema.purchaseLinks.gameId, gameIds));
    const linkMap = new Map<string, any[]>();
    for (const link of allLinks) {
      const arr = linkMap.get(link.gameId) || [];
      arr.push(link);
      linkMap.set(link.gameId, arr);
    }

    const results = await Promise.all(chunk.map(async (game) => {
      const links = linkMap.get(game.id) || [];
      if (links.length === 0) {
        console.log(`ℹ️ [No Links] ${game.title}`);
        return null;
      }
      return syncGamePrices(game, links);
    }));

    const allInserts = results.filter(Boolean).flat();
    if (allInserts.length > 0) {
      const dealGameIds = [...new Set(allInserts.map(v => v.gameId))];
      await turso
        .delete(schema.priceSnapshots)
        .where(
          and(
            inArray(schema.priceSnapshots.gameId, dealGameIds),
            eq(schema.priceSnapshots.country, "US")
          )
        );
      await turso.insert(schema.priceSnapshots).values(allInserts);
    }

    syncedCount += results.filter(r => r !== null).length;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Dynamic Price Sync completed in ${durationSec}s — ${syncedCount}/${games.length} games had deals.`);
}

main().catch(console.error);
