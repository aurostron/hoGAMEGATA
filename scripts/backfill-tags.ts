import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { MOODS, getMoodTagsForGame } from "./mood-rules";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

let prisma: PrismaClient;
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 60000,
  max: 10,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBackfill() {
  const twitchId = process.env.TWITCH_CLIENT_ID;
  const twitchSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!twitchId || !twitchSecret) {
    console.error("❌ Error: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET missing in .env.");
    process.exit(1);
  }

  console.log("🔑 Authenticating with Twitch Developer Portal...");
  const tokenResponse = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  
  if (!tokenResponse.ok) {
    throw new Error(`Twitch OAuth failed: ${tokenResponse.statusText}`);
  }

  const { access_token } = await tokenResponse.json() as { access_token: string };
  console.log("✅ Authenticated successfully!");

  // 1. Pre-upsert all MOOD tags
  console.log("🏷️  Pre-upserting all curated mood tags in database...");
  const moodTagMap = new Map<string, string>();
  for (const mood of MOODS) {
    const dbTag = await prisma.tag.upsert({
      where: { slug: mood.slug },
      update: { name: mood.name },
      create: { name: mood.name, slug: mood.slug }
    });
    moodTagMap.set(mood.slug, dbTag.id);
  }
  console.log("✅ Curated tags populated!");

  // 2. Fetch all games from DB
  console.log("🔍 Fetching all games from database to resolve keywords...");
  const games = await prisma.game.findMany({
    select: {
      id: true,
      igdbId: true,
      title: true,
      summary: true,
      storyline: true,
      genres: {
        select: { name: true, slug: true }
      }
    }
  });

  const totalGames = games.length;
  console.log(`📚 Found ${totalGames} games in database. Fetching keywords from IGDB...`);

  // 3. Batch fetch keywords from IGDB
  const keywordMap = new Map<number, Array<{ name: string; slug: string }>>();
  const BATCH_SIZE = 100;

  for (let i = 0; i < totalGames; i += BATCH_SIZE) {
    const chunk = games.slice(i, i + BATCH_SIZE);
    const igdbIds = chunk.map(g => g.igdbId).filter((id): id is number => id !== null);

    if (igdbIds.length === 0) continue;

    console.log(`📥 Fetching keywords for batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(totalGames / BATCH_SIZE)} (IDs: ${igdbIds.length})...`);

    const query = `
      fields id, keywords.name, keywords.slug;
      where id = (${igdbIds.join(",")});
      limit 100;
    `;

    try {
      const response = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
          "Client-ID": twitchId,
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "text/plain"
        },
        body: query
      });

      if (!response.ok) {
        console.error(`⚠️ Failed to fetch keywords for batch: ${response.statusText}`);
      } else {
        const data = await response.json() as Array<{ id: number; keywords?: Array<{ name: string; slug: string }> }>;
        for (const item of data) {
          if (item.keywords) {
            keywordMap.set(item.id, item.keywords);
          }
        }
      }
    } catch (err) {
      console.error(`⚠️ Network error on batch fetch:`, err);
    }

    // Throttle queries to avoid IGDB rate limits (4 req/sec limit)
    await sleep(300);
  }

  console.log(`\n🏷️  Applying taxonomy rules and writing tags to ${totalGames} games...`);

  // Helper batch writer with concurrency limit
  let processed = 0;
  const CONCURRENCY = 20;

  for (let i = 0; i < totalGames; i += CONCURRENCY) {
    const chunk = games.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async (game) => {
      const igdbKeywords = game.igdbId ? keywordMap.get(game.igdbId) || [] : [];
      const matchedMoods = getMoodTagsForGame({
        title: game.title,
        summary: game.summary,
        storyline: game.storyline,
        genres: game.genres,
        keywords: igdbKeywords
      });

      const tagConnects = matchedMoods
        .map(mood => {
          const tid = moodTagMap.get(mood.slug);
          return tid ? { id: tid } : null;
        })
        .filter((t): t is { id: string } => t !== null);

      await prisma.game.update({
        where: { id: game.id },
        data: {
          tags: {
            set: tagConnects
          }
        }
      });
    }));

    processed += chunk.length;
    if (processed % 200 === 0 || processed === totalGames) {
      console.log(`  ⚡ Processed and tagged: ${processed} / ${totalGames} games.`);
    }
  }

  console.log("\n🎉 Backfill tagging completed successfully!");
}

runBackfill()
  .then(() => {
    prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Backfill Error:", err);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
