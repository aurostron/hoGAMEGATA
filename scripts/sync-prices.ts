import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { fetchAggregatedDeals, extractSteamAppId } from "../src/lib/priceEngine";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 60000,
  max: 5,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function syncGamePrices(game: any) {
  let steamId: string | null = null;
  for (const link of game.purchaseLinks) {
    const id = extractSteamAppId(link.url);
    if (id) {
      steamId = id;
      break;
    }
  }

  try {
    // Fetch aggregated deals from CheapShark & ITAD
    const freshDeals = await fetchAggregatedDeals(steamId, game.title);

    if (freshDeals.length > 0) {
      await prisma.$transaction([
        prisma.priceSnapshot.deleteMany({ where: { gameId: game.id } }),
        prisma.priceSnapshot.createMany({
          data: freshDeals.map(deal => ({
            gameId: game.id,
            storeName: deal.storeName,
            dealPrice: deal.dealPrice,
            retailPrice: deal.retailPrice,
            discountPercent: deal.discountPercent,
            dealUrl: deal.dealUrl,
            updatedAt: new Date()
          }))
        })
      ]);
      const cheapest = freshDeals.reduce((min: any, d: any) => d.dealPrice < min.dealPrice ? d : min, freshDeals[0]);
      console.log(`✅ [Synced] ${game.title} - ${freshDeals.length} deals (Cheapest: $${cheapest.dealPrice} at ${cheapest.storeName})`);
    } else {
      console.log(`ℹ️ [No Deals Mapped] ${game.title}`);
    }
  } catch (error) {
    console.error(`❌ [Error] Failed syncing ${game.title}:`, error);
  }
}

async function main() {
  console.log("🚀 Starting Dynamic Price Comparison Sync Warmer (CheapShark + ITAD)...");
  const startTime = Date.now();

  const games = await prisma.game.findMany({
    orderBy: { popularity: { sort: "desc", nulls: "last" } },
    take: 150,
    include: { purchaseLinks: true },
  });

  console.log(`Fetched ${games.length} games to sync.`);

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    console.log(`[${i + 1}/${games.length}] Syncing prices for "${game.title}"...`);
    await syncGamePrices(game);
    // 350ms delay between requests to respect rate limits
    await sleep(350);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Dynamic Price Sync completed in ${durationSec}s.`);
}

main()
  .catch((e) => {
    console.error("❌ Fatal error in price sync script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
