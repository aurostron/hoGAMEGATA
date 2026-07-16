import "./load-env";
import {
  turso,
  schema,
  eq,
  or,
  lt,
  isNull,
  desc
} from "./db-helper";

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
    const pcPlatform = data.platforms?.find((p: any) => p.platform?.slug === "pc");
    const requirements = pcPlatform?.requirements_en || pcPlatform?.requirements || null;
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
    const directUrl = `https://api.rawg.io/api/games/${slug}?key=${apiKey}`;
    const directResponse = await fetchWithBackoff(directUrl);
    
    if (directResponse.ok) {
      const data = await directResponse.json();
      if (data) return parseRawgData(data);
    }

    console.log(`🔍 RAWG direct slug match failed for '${slug}'. Searching by title '${title}'...`);
    const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
    const searchResponse = await fetchWithBackoff(searchUrl);
    
    if (searchResponse.ok) {
      const searchData = (await searchResponse.json()) as { results?: any[] };
      const bestMatch = searchData.results?.[0];
      
      if (bestMatch) {
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
  const args = process.argv.slice(2);
  
  let rawgApiKey = process.env.RAWG_API_KEY;
  const keyIndex = args.indexOf("--api-key");
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    rawgApiKey = args[keyIndex + 1];
  }

  if (!rawgApiKey) {
    console.error("❌ Error: RAWG_API_KEY is missing. Please provide it via .env or --api-key argument.");
    process.exit(1);
  }

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
  
  const gamesToProcess = await turso
    .select({ id: schema.games.id, title: schema.games.title, slug: schema.games.slug })
    .from(schema.games)
    .where(
      or(
        eq(schema.games.rawgEnriched, false),
        lt(schema.games.lastRawgSync, thirtyDaysAgo),
        isNull(schema.games.lastRawgSync)
      )
    )
    .orderBy(desc(schema.games.rating))
    .limit(batchLimit);

  const countVal = gamesToProcess.length;
  if (countVal === 0) {
    console.log("🎉 All games in the database are already enriched and fresh!");
    return;
  }

  console.log(`📚 Found ${countVal} games to process. Starting enrichment in parallel chunks of 5...`);

  let enrichedCount = 0;
  const CONCURRENCY_LIMIT = 5;

  for (let i = 0; i < countVal; i += CONCURRENCY_LIMIT) {
    const chunk = gamesToProcess.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`\n📦 Processing parallel chunk ${Math.floor(i / CONCURRENCY_LIMIT) + 1} of ${Math.ceil(countVal / CONCURRENCY_LIMIT)}...`);

    await Promise.all(chunk.map(async (game) => {
      console.log(`  🔄 Fetching RAWG: ${game.title} (slug: ${game.slug})`);
      
      const details = await fetchRawgGameDetails(game.title, game.slug, rawgApiKey);

      if (details) {
        await turso
          .update(schema.games)
          .set({
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
          })
          .where(eq(schema.games.id, game.id));
        console.log(`  ✅ Cached metadata for: ${game.title}`);
        enrichedCount++;
      } else {
        await turso
          .update(schema.games)
          .set({
            rawgEnriched: true,
            lastRawgSync: new Date()
          })
          .where(eq(schema.games.id, game.id));
        console.log(`  ⚠️ RAWG metadata not found. Marked: ${game.title} as enriched with fallback.`);
      }
    }));

    await sleep(Math.floor(Math.random() * 200) + 100);
  }

  console.log(`\n🎉 Background enrichment batch complete! Enriched ${enrichedCount} of ${countVal} games.`);
}

runEnrichment()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Enrichment Error:", err);
    process.exit(1);
  });
