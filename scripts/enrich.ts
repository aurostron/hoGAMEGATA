import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

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

interface RawgDetails {
  rawgId: number | null;
  metacritic: number | null;
  metacriticUrl: string | null;
  playtime: number | null;
  esrbRating: string | null;
  redditUrl: string | null;
  websiteUrl: string | null;
  rawgRating: number | null;
  rawgSlug: string | null;
  minRequirements: string | null;
  recRequirements: string | null;
}

// Robust fetch utility with exponential backoff for 429 rate limiting and network faults
async function fetchWithBackoff(url: string, retries = 3, delay = 2000): Promise<Response> {
  try {
    const response = await fetch(url);
    if (response.status === 429 && retries > 0) {
      console.warn(`⚠️ RAWG API returned 429 (Too Many Requests). Retrying in ${delay}ms... (${retries} retries left)`);
      await sleep(delay);
      return fetchWithBackoff(url, retries - 1, delay * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`⚠️ Network error: ${error}. Retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchWithBackoff(url, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function fetchRawgGameDetails(
  title: string,
  slug: string,
  apiKey: string
): Promise<RawgDetails | null> {
  const parseRawgData = (data: any): RawgDetails => {
    // Extract PC requirements
    const pcPlatform = data.platforms?.find((p: any) => p.platform?.slug === "pc");
    const requirements = pcPlatform?.requirements_en || null;
    const minRequirements = requirements?.minimum || null;
    const recRequirements = requirements?.recommended || null;

    return {
      rawgId: data.id || null,
      metacritic: data.metacritic || null,
      metacriticUrl: data.metacritic_url || null,
      playtime: data.playtime || null,
      esrbRating: data.esrb_rating?.name || null,
      redditUrl: data.reddit_url || null,
      websiteUrl: data.website || null,
      rawgRating: data.rating || null,
      rawgSlug: data.slug || null,
      minRequirements,
      recRequirements,
    };
  };

  try {
    // 1. Try to fetch directly by slug
    const directUrl = `https://api.rawg.io/api/games/${slug}?key=${apiKey}`;
    const directResponse = await fetchWithBackoff(directUrl);
    
    if (directResponse.ok) {
      const data = await directResponse.json();
      if (data) return parseRawgData(data);
    }

    // 2. If 404/failure, fallback to search by title
    console.log(`🔍 RAWG direct slug match failed for '${slug}'. Searching by title '${title}'...`);
    const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
    const searchResponse = await fetchWithBackoff(searchUrl);
    
    if (searchResponse.ok) {
      const searchData = (await searchResponse.json()) as { results?: any[] };
      const bestMatch = searchData.results?.[0];
      
      if (bestMatch) {
        // Fetch detailed data for this game ID
        const detailUrl = `https://api.rawg.io/api/games/${bestMatch.id}?key=${apiKey}`;
        const detailResponse = await fetchWithBackoff(detailUrl);
        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          return parseRawgData(detailData);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Failed to fetch RAWG details for '${title}':`, error);
  }

  return null;
}

async function runEnrichment() {
  const rawgApiKey = process.env.RAWG_API_KEY;
  if (!rawgApiKey) {
    console.error("❌ Error: RAWG_API_KEY is missing in your .env file.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let batchLimit = 100;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      batchLimit = parsedLimit;
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log(`🧹 Querying database for up to ${batchLimit} unenriched or stale (30d+) games...`);
  
  const gamesToProcess = await prisma.game.findMany({
    where: {
      OR: [
        { rawgEnriched: false },
        { lastRawgSync: { lt: thirtyDaysAgo } }
      ]
    },
    orderBy: [
      { wishlists: { _count: "desc" } },
      { rating: "desc" }
    ],
    take: batchLimit,
    select: { id: true, title: true, slug: true }
  });

  const count = gamesToProcess.length;
  if (count === 0) {
    console.log("🎉 All games in the database are already enriched and fresh!");
    return;
  }

  console.log(`📚 Found ${count} games to process. Starting enrichment in parallel chunks of 5...`);

  let enrichedCount = 0;
  const CONCURRENCY_LIMIT = 5;

  for (let i = 0; i < count; i += CONCURRENCY_LIMIT) {
    const chunk = gamesToProcess.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`\n📦 Processing parallel chunk ${Math.floor(i / CONCURRENCY_LIMIT) + 1} of ${Math.ceil(count / CONCURRENCY_LIMIT)}...`);

    await Promise.all(chunk.map(async (game) => {
      console.log(`  🔄 Fetching RAWG: ${game.title} (slug: ${game.slug})`);
      
      const details = await fetchRawgGameDetails(game.title, game.slug, rawgApiKey);

      if (details) {
        await prisma.game.update({
          where: { id: game.id },
          data: {
            rawgEnriched: true,
            rawgId: details.rawgId,
            metacritic: details.metacritic,
            metacriticUrl: details.metacriticUrl,
            playtime: details.playtime,
            esrbRating: details.esrbRating,
            redditUrl: details.redditUrl,
            websiteUrl: details.websiteUrl,
            rawgRating: details.rawgRating,
            rawgSlug: details.rawgSlug,
            minRequirements: details.minRequirements,
            recRequirements: details.recRequirements,
            lastRawgSync: new Date()
          }
        });
        console.log(`  ✅ Cached metadata for: ${game.title}`);
        enrichedCount++;
      } else {
        // Mark as enriched to avoid loops, saving execution date
        await prisma.game.update({
          where: { id: game.id },
          data: {
            rawgEnriched: true,
            lastRawgSync: new Date()
          }
        });
        console.log(`  ⚠️ RAWG metadata not found. Marked: ${game.title} as enriched with fallback.`);
      }
    }));

    // Rate limit safeguard: Wait briefly between concurrent chunks (random 100-300ms)
    await sleep(Math.floor(Math.random() * 200) + 100);
  }

  console.log(`\n🎉 Background enrichment batch complete! Enriched ${enrichedCount} of ${count} games.`);
}

runEnrichment()
  .then(() => {
    prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Enrichment Error:", err);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
