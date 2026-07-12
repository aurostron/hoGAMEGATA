import "./load-env";
process.env.OPENAI_API_KEY = process.env.FREELLM_API_KEY;
import OpenAI from "openai";
import {
  turso,
  schema,
  eq,
  and,
  or,
  lt,
  isNull,
  desc,
  inArray,
} from "./db-helper";

let freeLlm: OpenAI;
let usingLocal = false;

function initLlmClient() {
  const args = process.argv.slice(2);
  const isLocal = args.includes("--local") || args.includes("--lmstudio");
  
  if (isLocal) {
    usingLocal = true;
    console.log("🤖 Configured for Local LM Studio (localhost:1234)...");
    
    // Clear out proxy environment variables for local connection
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    delete process.env.https_proxy;
    delete process.env.http_proxy;

    freeLlm = new OpenAI({
      apiKey: "lm-studio",
      baseURL: "http://localhost:1234/v1",
    });
  } else {
    usingLocal = false;
    console.log("🤖 Configured for Remote FreeLLM (localhost:3001)...");
    
    process.env.OPENAI_API_KEY = process.env.FREELLM_API_KEY;
    process.env.OPENAI_BASE_URL = "http://localhost:3001/v1";
    if (process.env.PROXY_URL) {
      process.env.HTTPS_PROXY = process.env.PROXY_URL;
      process.env.HTTP_PROXY = process.env.PROXY_URL;
    }

    freeLlm = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
}

initLlmClient();

/** Strip markdown code‑fence wrappers (```json … ``` etc.) from LLM output */
function extractJson(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export interface ScareProfile {
  dread: number;
  jumpscare: number;
  psychological: number;
  gore: number;
  tension: number;
  disturbing: number;
  isolation: number;
  shortSummary?: string;
  playerWarnings?: string[];
}

async function fetchSteamReviews(steamAppId: string): Promise<any[]> {
  try {
    const url = `https://store.steampowered.com/appreviews/${steamAppId}?json=1&cursor=*&num_per_page=100&filter=recent&language=english&purchase_type=all`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 hoGAMEGATA/1.0",
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.reviews || [];
    }
  } catch (e) {
    console.error(`⚠️ Failed to fetch Steam reviews for ${steamAppId}:`, e);
  }
  return [];
}

function cleanAndExtractReviews(reviews: any[]): string {
  const cleaned = reviews.filter((r) => {
    const txt = (r.review || "").trim();
    const words = txt.split(/\s+/).length;
    return words >= 10 && !txt.includes("shat my pants 10/10");
  });
  const top = cleaned.slice(0, 60);
  if (!top.length) return "";
  return top
    .map((r, i) => {
      let txt = r.review.replace(/\s+/g, " ").trim();
      if (txt.length > 500) txt = txt.substring(0, 500) + "...";
      return `[${i + 1}] ${txt}`;
    })
    .join(" ");
}

// --- Steam‑based Scare analysis ------------------------------------------------
async function processSteamScare(reviews: any[]): Promise<{ rating: number; profile: ScareProfile; reviewCount: number } | null> {
  const digest = cleanAndExtractReviews(reviews);
  if (!digest) return null;
  const prompt = `You are an expert horror game analysis engine.
Analyze player sentiment and determine the game's scare profile based on these Steam reviews.
Generate a structured JSON output with a global "scareRating" (0‑100) and sub‑ratings (0‑100) for dread, jumpscare, psychological, gore, tension, disturbing, and isolation.
Also provide a 1‑sentence "shortSummary" and a list of "playerWarnings" if applicable.

Reviews:\n${digest}`;

  try {
    console.log("  📡 Attempting Scare analysis via FreeLLM...");
    const resp = await freeLlm.chat.completions.create({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
      response_format: usingLocal ? undefined : { type: "json_object" },
    });
    const txt = resp.choices[0]?.message?.content;
    if (txt) {
      const parsed = JSON.parse(extractJson(txt));
      if (parsed.scareRating !== undefined) {
        return { rating: parsed.scareRating, profile: parsed, reviewCount: reviews.length };
      }
    }
  } catch (e) {
    console.warn(`  ⚠️ FreeLLM failed for Steam analysis: ${(e as Error).message}`);
  }
  return null;
}

// --- Metadata‑based Taxonomy analysis (batched: N games per call) ------------
const TAX_BATCH_SIZE = 5;

async function processTaxonomyBatch(
  batch: Array<{ id: string; title: string; summary: string; developer: string; genreNames: string }>
): Promise<Map<string, { rating: number; profile: ScareProfile }>> {
  const items = batch.map((g, i) =>
    `${i + 1}. Title: "${g.title}" | Developer: "${g.developer}" | Genres: "${g.genreNames}" | Description: "${g.summary}"`
  ).join("\n");

  const prompt = `You are an expert horror game analysis engine.
Analyze each game below and estimate its scare ratings (0-100) for dread, jumpscare, psychological, gore, tension, disturbing, and isolation.
Note: If you recognize a game or franchise (e.g., "The Last of Us", "Resident Evil", "Dead by Daylight", "Gears of War", "Salt and Sanctuary"), prioritize your broad parametric knowledge of that game's actual horror content and themes to estimate the ratings, rather than relying strictly on the text descriptions (which might only list physical collector's edition contents or brief outlines).

For every game return an object with scareRating (0-100), dread (0-100), jumpscare (0-100), psychological (0-100), gore (0-100), tension (0-100), disturbing (0-100), isolation (0-100), shortSummary (string), and playerWarnings (string array).

${items}

Return ONLY a JSON object with a single "games" key. The value is an array of results, one per game, in the same order as listed above.
Example: {"games": [{"scareRating":70,"dread":60,...},{"scareRating":45,...}]}`;

  try {
    console.log(`  📡 Batch taxonomy analysis for ${batch.length} games…`);
    const resp = await freeLlm.chat.completions.create({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
      response_format: usingLocal ? undefined : { type: "json_object" },
    });
    const txt = resp.choices[0]?.message?.content;
    const results = new Map<string, { rating: number; profile: ScareProfile }>();
    if (txt) {
      const parsed = JSON.parse(extractJson(txt));
      const arr = parsed.games || parsed;
      if (Array.isArray(arr)) {
        batch.forEach((g, i) => {
          const entry = arr[i];
          if (entry && entry.scareRating !== undefined) {
            results.set(g.id, { rating: entry.scareRating, profile: entry });
          }
        });
      }
    }
    return results;
  } catch (e) {
    console.warn(`  ⚠️ FreeLLM failed for batch taxonomy analysis: ${(e as Error).message}`);
    return new Map();
  }
}

// ---------------------------------------------------------------------------
async function runScareEnrichment() {
  const args = process.argv.slice(2);
  let batchLimit = 50;
  let targetSlug: string | null = null;
  let targetTag: string | null = null;

  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    const n = parseInt(args[limitIdx + 1], 10);
    if (!isNaN(n)) batchLimit = n;
  }
  const slugIdx = args.indexOf("--slug");
  if (slugIdx !== -1 && args[slugIdx + 1]) targetSlug = args[slugIdx + 1];
  const tagIdx = args.indexOf("--tag");
  if (tagIdx !== -1 && args[tagIdx + 1]) targetTag = args[tagIdx + 1];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log(`🤖 Loading FreeLLM API for Scare Analysis…`);

  let games: any[] = [];
  if (targetSlug) {
    batchLimit = 1;
    const rows = await turso.select().from(schema.games).where(eq(schema.games.slug, targetSlug)).limit(1);
    games = rows;
  } else if (targetTag) {
    const rows = await turso
      .select({ game: schema.games })
      .from(schema.games)
      .innerJoin(schema.gamesToTags, eq(schema.games.id, schema.gamesToTags.gameId))
      .innerJoin(schema.tags, eq(schema.gamesToTags.tagId, schema.tags.id))
      .where(and(eq(schema.tags.slug, targetTag), or(isNull(schema.games.scareRating), lt(schema.games.lastScareSync, thirtyDaysAgo))))
      .orderBy(desc(schema.games.popularity))
      .limit(batchLimit);
    games = rows.map((r) => r.game);
  } else {
    const rows = await turso
      .select()
      .from(schema.games)
      .where(or(isNull(schema.games.scareRating), lt(schema.games.lastScareSync, thirtyDaysAgo)))
      .orderBy(desc(schema.games.popularity))
      .limit(batchLimit);
    games = rows;
  }

  const total = games.length;
  if (!total) {
    console.log("🎉 No games require enrichment.");
    return;
  }
  console.log(`👻 Processing ${total} games…`);

  const CONCURRENCY = 5;
  let enriched = 0;

  for (let i = 0; i < total; i += CONCURRENCY) {
    const chunk = games.slice(i, i + CONCURRENCY);
    const gameIds = chunk.map(g => g.id);

    const allLinks = await turso.select().from(schema.purchaseLinks).where(inArray(schema.purchaseLinks.gameId, gameIds));
    const linkMap = new Map<string, any[]>();
    for (const link of allLinks) {
      const arr = linkMap.get(link.gameId) || [];
      arr.push(link);
      linkMap.set(link.gameId, arr);
    }

    // Batch Taxonomy: process all chunk games in groups of TAX_BATCH_SIZE
    const taxMap = new Map<string, { rating: number; profile: ScareProfile } | null>();
    for (let b = 0; b < chunk.length; b += TAX_BATCH_SIZE) {
      const batchGames = chunk.slice(b, b + TAX_BATCH_SIZE);
      const batchMeta = batchGames.map(g => ({
        id: g.id,
        title: g.title,
        summary: g.summary || "",
        developer: g.developerNames || "Unknown",
        genreNames: g.genreNames || "Horror",
      }));
      const batchResults = await processTaxonomyBatch(batchMeta);
      for (const [id, result] of batchResults) {
        taxMap.set(id, result);
      }
      // Missing games get null
      for (const g of batchGames) {
        if (!taxMap.has(g.id)) taxMap.set(g.id, null);
      }
    }

    const results = await Promise.all(chunk.map(async (game, chunkIdx) => {
      const idx = i + chunkIdx + 1;
      console.log(`\n📦 ${idx}/${total}: ${game.title}`);

      const links = linkMap.get(game.id) || [];
      const steamLink = links.find((l: any) => l.storeName === "Steam" || l.url.includes("store.steampowered.com"));

      const steamSignal = steamLink ? await (async () => {
        const match = steamLink.url.match(/\/app\/(\d+)/);
        if (!match) return null;
        const reviews = await fetchSteamReviews(match[1]);
        return reviews.length ? processSteamScare(reviews) : null;
      })() : null;

      const taxSignal = taxMap.get(game.id) ?? null;

      if (!steamSignal && !taxSignal) {
        console.warn("  ❌ Both analyses failed – skipping.");
        return false;
      }
      let finalRating: number | null = null;
      let finalProfile: ScareProfile = { dread: 0, jumpscare: 0, psychological: 0, gore: 0, tension: 0, disturbing: 0, isolation: 0 };
      let reviewCount = 0;
      if (steamSignal && taxSignal) {
        finalRating = Math.round(steamSignal.rating * 0.7 + taxSignal.rating * 0.3);
        reviewCount = steamSignal.reviewCount;
        const keys = ["dread", "jumpscare", "psychological", "gore", "tension", "disturbing", "isolation"] as const;
        keys.forEach((k) => {
          // @ts-ignore – dynamic indexing
          finalProfile[k] = Math.round((steamSignal.profile[k] * 0.7 + taxSignal.profile[k] * 0.3) as any);
        });
        finalProfile.shortSummary = steamSignal.profile.shortSummary;
        finalProfile.playerWarnings = steamSignal.profile.playerWarnings;
      } else if (steamSignal) {
        finalRating = steamSignal.rating;
        finalProfile = steamSignal.profile;
        reviewCount = steamSignal.reviewCount;
      } else if (taxSignal) {
        finalRating = taxSignal.rating;
        finalProfile = taxSignal.profile;
      }
      await turso.update(schema.games).set({
        scareRating: finalRating,
        scareProfile: JSON.stringify(finalProfile),
        scareReviewCount: reviewCount,
        lastScareSync: new Date(),
      }).where(eq(schema.games.id, game.id));
      console.log(`  ... Cached scare rating for ${game.title} (Score: ${finalRating ?? "N/A"})`);
      return true;
    }));

    enriched += results.filter(Boolean).length;
  }
  console.log(`\n🎉 Done – processed ${enriched}/${total} games.`);
}

runScareEnrichment().catch((e) => {
  console.error("❌ Process crashed:", e);
  process.exit(1);
});