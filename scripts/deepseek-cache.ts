import { turso, schema, inArray, or, isNull, ne, and, like } from "./db-helper";
import { enrichGamesWithRelations } from "../src/lib/gameQueries";
import * as fs from "fs";
import * as path from "path";
import readline from "readline";
import { pathToFileURL } from "url";

const DRAFT_FILE_PATH = path.join(process.cwd(), "pending-search-cache.json");
const DRIVER_PATH = "C:\\Users\\bapum\\Downloads\\deepseek-cli\\deepseek.mjs";

export interface FastRecommendationItem {
  title: string;
  score: number;
  tags?: string[];
}

function slugifyQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Ultra-fast token-efficient prompt for DeepSeek.
 * Minimizes output token count by using compact JSON keys ('t', 's', 'tags')
 * for 3x faster response times without sacrificing recommendations quality.
 */
export function buildFastDeepSeekPrompt(gameTitle: string): string {
  return `You are a horror game recommendation engine.
Provide a list of up to 10 real horror video games similar to "${gameTitle}".
Include a mix of popular mainstream games alongside great indie horror games. Rank the results placing the most popular and widely recognized games near the top.
Do not invent fake titles. Respond strictly in English.

Respond ONLY with a compact JSON array:
[{"t":"Exact Game Title","s":0.95,"tags":["survival-horror"]}]

Keys: "t"=Title, "s"=Match score (0.0-1.0), "tags"=1-2 simple genre tags.
No intro, no thinking preamble, no markdown text outside JSON.`;
}

export function parseFastJsonResponse(text: string, minScore = 0.6): FastRecommendationItem[] {
  if (!text) return [];

  let cleanText = text.trim();

  // 1. Strip markdown code fences (```json ... ```)
  const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    cleanText = jsonMatch[1].trim();
  }

  // 2. Extract JSON array of objects ([{...}]) using regex to bypass CoT preamble text
  const arrayMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    cleanText = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(cleanText);
    const arr = Array.isArray(parsed) 
      ? parsed 
      : (parsed.recommendations || parsed.games || parsed.suggested_titles || parsed.results || []);

    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter((item: any) => item && (item.t || item.title || typeof item === "string"))
        .map((item: any) => {
          if (typeof item === "string") {
            return { title: item.trim().replace(/^["'`]+|["'`]+$/g, ""), score: 0.8, tags: [] };
          }
          return {
            title: String(item.t || item.title).trim().replace(/^["'`]+|["'`]+$/g, ""),
            score: typeof (item.s ?? item.score ?? item.confidence) === "number" 
              ? Math.min(1.0, Math.max(0.0, item.s ?? item.score ?? item.confidence)) 
              : 0.8,
            tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          };
        })
        .filter((item) => item.score >= minScore);
    }
  } catch (err) {}

  // 3. Fallback: parse plain text lines
  const lines = text.split("\n");
  const fallbackItems: FastRecommendationItem[] = [];
  for (const line of lines) {
    let clean = line.trim().replace(/^(?:\d+[\.\)]|\-|\*|•|\>)\s*/, "").replace(/^["'`]+|["'`]+$/g, "").replace(/[\s\-\:\.\,]+$/, "").trim();
    if (clean.length > 2 && clean.length < 80 && !clean.endsWith(":") && !clean.toLowerCase().includes("here is a list") && !clean.toLowerCase().includes("games like")) {
      fallbackItems.push({ title: clean, score: 0.75, tags: [] });
    }
  }

  return fallbackItems;
}

async function verifyItemsInDb(items: FastRecommendationItem[], excludeTitle: string): Promise<{ verifiedItems: FastRecommendationItem[]; dbVerifiedTitles: string[] }> {
  const verifiedItems: FastRecommendationItem[] = [];
  const dbVerifiedTitles: string[] = [];
  const excludeLower = excludeTitle.toLowerCase().trim();

  for (const item of items) {
    if (!item.title) continue;
    if (item.title.toLowerCase().trim() === excludeLower) continue;

    // 1. Try exact match
    const [exact] = await turso
      .select({ title: schema.games.title })
      .from(schema.games)
      .where(and(
        like(schema.games.title, item.title.trim()),
        or(isNull(schema.games.status), ne(schema.games.status, "hidden"))
      ))
      .limit(1);

    if (exact) {
      if (!dbVerifiedTitles.includes(exact.title)) {
        dbVerifiedTitles.push(exact.title);
        verifiedItems.push({ ...item, title: exact.title });
      }
      continue;
    }

    // 2. Try substring match
    const [approx] = await turso
      .select({ title: schema.games.title })
      .from(schema.games)
      .where(and(
        like(schema.games.title, `%${item.title.trim()}%`),
        or(isNull(schema.games.status), ne(schema.games.status, "hidden"))
      ))
      .limit(1);

    if (approx && approx.title.toLowerCase().trim() !== excludeLower) {
      if (!dbVerifiedTitles.includes(approx.title)) {
        dbVerifiedTitles.push(approx.title);
        verifiedItems.push({ ...item, title: approx.title });
      }
    }
  }

  return { verifiedItems, dbVerifiedTitles };
}

async function saveAndApplyCache(queryStr: string, allItems: FastRecommendationItem[], verifiedTitles: string[]): Promise<number> {
  const queryKey = `games like ${queryStr.toLowerCase().trim()}`;
  const querySlug = slugifyQuery(queryKey);

  // 1. Save to local draft JSON
  let draftData: Record<string, { query: string; llm_suggestions: any[]; db_verified: string[] }> = {};
  if (fs.existsSync(DRAFT_FILE_PATH)) {
    try {
      draftData = JSON.parse(fs.readFileSync(DRAFT_FILE_PATH, "utf8"));
    } catch {}
  }

  draftData[queryKey] = {
    query: queryKey,
    llm_suggestions: allItems,
    db_verified: verifiedTitles,
  };
  fs.writeFileSync(DRAFT_FILE_PATH, JSON.stringify(draftData, null, 2), "utf8");

  if (verifiedTitles.length === 0) {
    console.warn(`⚠️ No DB verified games found for query "${queryStr}"`);
    return 0;
  }

  // 2. Query raw games from DB
  const rawGames = await turso
    .select()
    .from(schema.games)
    .where(and(
      inArray(schema.games.title, verifiedTitles),
      or(isNull(schema.games.status), ne(schema.games.status, "hidden"))
    ));

  if (rawGames.length === 0) return 0;

  // Rank games by combined LLM similarity score + Database popularity score
  const scoreMap = new Map(allItems.map((item) => [item.title.toLowerCase().trim(), item.score]));

  rawGames.sort((a, b) => {
    const scoreA = scoreMap.get(a.title.toLowerCase().trim()) ?? 0.7;
    const scoreB = scoreMap.get(b.title.toLowerCase().trim()) ?? 0.7;

    const popA = a.popularity ? Math.min(100, Math.max(0, a.popularity)) / 100 : 0.2;
    const popB = b.popularity ? Math.min(100, Math.max(0, b.popularity)) / 100 : 0.2;

    const combinedA = (scoreA * 0.6) + (popA * 0.4);
    const combinedB = (scoreB * 0.6) + (popB * 0.4);

    return combinedB - combinedA;
  });

  const enrichedGames = await enrichGamesWithRelations(rawGames);

  // 3. Upsert directly into Turso ai_search_cache
  await turso
    .insert(schema.aiSearchCache)
    .values({
      id: querySlug,
      query: queryKey.toLowerCase().trim(),
      resultsJson: JSON.stringify(enrichedGames),
    })
    .onConflictDoUpdate({
      target: schema.aiSearchCache.id,
      set: {
        resultsJson: JSON.stringify(enrichedGames),
      },
    });

  console.log(`✅ Applied cache to Turso DB for: "\x1b[36m${queryKey}\x1b[0m" (\x1b[32m${enrichedGames.length} verified games\x1b[0m)`);
  return enrichedGames.length;
}

async function processSingleGame(gameTitle: string, sendPrompt: any, page: any, minScore = 0.6) {
  const startTime = Date.now();
  console.log(`\n🔍 Querying DeepSeek for: "\x1b[35m${gameTitle}\x1b[0m"`);
  const prompt = buildFastDeepSeekPrompt(gameTitle);

  const rawResponse = await sendPrompt(page, prompt);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  
  const items = parseFastJsonResponse(rawResponse, minScore);

  if (items.length === 0) {
    console.log("DEBUG: Raw LLM Output was:\n", rawResponse.slice(0, 500));
  }

  console.log(`⚡ Response received in ${durationSec}s! Parsed ${items.length} recommendations:`);
  for (const item of items) {
    const scorePct = Math.round(item.score * 100);
    const tagsStr = item.tags && item.tags.length ? ` [${item.tags.join(", ")}]` : "";
    console.log(`   • \x1b[33m${item.title}\x1b[0m (${scorePct}% match)${tagsStr}`);
  }

  const { verifiedItems, dbVerifiedTitles } = await verifyItemsInDb(items, gameTitle);
  console.log(`✅ DB Verified (${dbVerifiedTitles.length}): \x1b[32m[${dbVerifiedTitles.join(", ")}]\x1b[0m`);

  await saveAndApplyCache(gameTitle, items, dbVerifiedTitles);
}

async function main() {
  const args = process.argv.slice(2);
  let targetGame: string | null = null;
  let randomCount = 0;
  let isHeadless = false;
  let minScore = 0.6;
  let profileName = "Profile 1";
  let sameChat = false;
  let keepOpen = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--game=")) {
      targetGame = arg.slice(7).trim();
      while (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        targetGame += " " + args[i + 1];
        i++;
      }
      targetGame = targetGame.replace(/^["'`]+|["'`]+$/g, "").trim();
    } else if (arg.startsWith("--random=")) {
      randomCount = parseInt(arg.slice(9), 10) || 10;
    } else if (arg.startsWith("--confidence=") || arg.startsWith("--score=")) {
      minScore = parseFloat(arg.slice(arg.indexOf("=") + 1)) || 0.6;
    } else if (arg.startsWith("--profile=")) {
      profileName = arg.slice(10).trim();
    } else if (arg === "--same-chat") {
      sameChat = true;
    } else if (arg === "--keep-open") {
      keepOpen = true;
    } else if (arg === "--headless") {
      isHeadless = true;
    } else if (arg === "--headed") {
      isHeadless = false;
    }
  }

  const driverUrl = pathToFileURL(DRIVER_PATH).href;
  console.log(`🔌 Loading DeepSeek driver from: ${DRIVER_PATH}`);
  const { createDeepSeekSession, sendPrompt, startNewChat } = await import(driverUrl);

  const { browser, page } = await createDeepSeekSession({ 
    headless: isHeadless, 
    useBraveProfile: true, 
    profile: profileName 
  });

  try {
    if (targetGame) {
      await processSingleGame(targetGame, sendPrompt, page, minScore);
    } else if (randomCount > 0) {
      console.log(`\n🎲 Fetching ${randomCount} random uncached games from database...`);

      const cached = await turso.select({ id: schema.aiSearchCache.id }).from(schema.aiSearchCache);
      const cachedSet = new Set(cached.map((c) => c.id));

      const allGames = await turso
        .select({ id: schema.games.id, title: schema.games.title })
        .from(schema.games)
        .where(or(isNull(schema.games.status), ne(schema.games.status, "hidden")));

      const uncachedGames = allGames.filter((g) => {
        const slug = slugifyQuery(`games like ${g.title}`);
        return !cachedSet.has(slug);
      });

      for (let i = uncachedGames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uncachedGames[i], uncachedGames[j]] = [uncachedGames[j], uncachedGames[i]];
      }

      const batch = uncachedGames.slice(0, randomCount);
      console.log(`📋 Selected ${batch.length} games to process.\n`);

      for (let i = 0; i < batch.length; i++) {
        const game = batch[i];
        console.log(`\n🔍 [${i + 1}/${batch.length}] Game: "\x1b[35m${game.title}\x1b[0m"`);

        if (!sameChat) await startNewChat(page);

        try {
          await processSingleGame(game.title, sendPrompt, page, minScore);
        } catch (err: any) {
          console.error(`❌ Error processing "${game.title}":`, err.message);
        }

        await new Promise((r) => setTimeout(r, 1500));
      }
    } else {
      console.log(`\n💬 Entering Interactive Manual Mode. Type a game title or /exit to quit.\n`);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string) => new Promise<string>((r) => rl.question(q, r));

      while (true) {
        const input = await ask("🎮 Enter game title (or /exit): ");
        const trimmed = input.trim();
        if (!trimmed) continue;
        if (trimmed === "/exit" || trimmed === "/quit") break;

        if (!sameChat) await startNewChat(page);
        try {
          await processSingleGame(trimmed, sendPrompt, page, minScore);
        } catch (err: any) {
          console.error(`❌ Error:`, err.message);
        }
        console.log("");
      }
      rl.close();
    }
  } finally {
    if (!keepOpen) {
      await browser.close();
      console.log("\n👋 Playwright session closed. Done!");
    } else {
      console.log("\n📌 Browser kept open as requested. Press Ctrl+C in terminal to stop.");
    }
  }
}

main().catch((err) => {
  console.error("❌ Fatal error in deepseek-cache:", err);
  process.exit(1);
});
