import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";

interface ScareProfilePayload {
  dread: number;
  jumpscare: number;
  psychological: number;
  gore: number;
  tension: number;
  disturbing: number;
  isolation: number;
  shortSummary: string;
  playerWarnings: string[];
  subFeelings: string[];
}

interface Pass2Result {
  id: string;
  title: string;
  isHorror: boolean;
  classification: "pure-horror" | "horror-adjacent" | "non-horror";
  scareRating: number;
  scareProfile: ScareProfilePayload;
  redditUrl?: string;
  reason: string;
}

const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL_NAME = "qwen3.5-9b-claude-4.6-highiq-instruct-heretic-uncensored";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMultiSiteContext(title: string, developer?: string): Promise<{ context: string; redditUrl?: string }> {
  const query = `${title} ${developer ? `by ${developer}` : ""} horror game scary discussion reddit review`;
  let context = "";
  let redditUrl: string | undefined;

  // 1. Query Tavily with Reddit, Steam, Itch
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "basic",
          max_results: 3,
        }),
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        context = data.results.map((r: any) => `[${r.title}] (${r.url}):\n${r.content}`).join("\n\n");
        const redditItem = data.results.find((r: any) => r.url?.includes("reddit.com/r/"));
        if (redditItem) {
          redditUrl = redditItem.url;
        }
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Tavily search warning: ${e.message}`);
    }
  }

  // 2. Query Exa as fallback/supplement if context is sparse
  if (!context && process.env.EXA_API_KEY) {
    try {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.EXA_API_KEY,
        },
        body: JSON.stringify({
          query: `${title} horror game scary discussion reddit`,
          includeDomains: ["reddit.com", "steampowered.com", "itch.io"],
          numResults: 3,
        }),
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        context = data.results.map((r: any) => `[${r.title}] (${r.url})`).join("\n");
        const redditItem = data.results.find((r: any) => r.url?.includes("reddit.com"));
        if (redditItem) {
          redditUrl = redditItem.url;
        }
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Exa search warning: ${e.message}`);
    }
  }

  return { context, redditUrl };
}

async function analyzeWithModel(game: any, searchContext: string): Promise<Pass2Result> {
  const prompt = `You are the lead game critic and horror curator for Gamegata, the definitive horror gaming catalog.
Your mission is to evaluate whether this game belongs in Gamegata (KEEP or HIDE):

Game Details:
- Title: ${game.title}
- Developer: ${game.developerNames || "Unknown"}
- Database Summary: ${game.summary || "None"}
- Multi-site Web & Reddit Context:
${searchContext || "No external search data found."}

DECISION RULES:
1. KEEP (isHorror = true):
   - "pure-horror": Classic survival horror, psychological terror, analog horror, slasher, body horror, cosmic dread, jumpscare, monster horror, or indie dread.
   - "horror-adjacent": Games with prominent horror themes, eerie uncanny vibes, macabre art, psychological thriller elements, gothic tragedy, or surreal dread (e.g., Castlevania, Signalis, Darkest Dungeon, Alice Madness Returns, eerie PS1 lo-fi mysteries).
   - CRITICAL RULE: Action-horror, survival-horror, and dark story-driven games that prominently feature visceral monsters, grotesque body horror (e.g., The Last of Us, Dead Space, BioShock, Resident Evil 4/5/Village), stalker stealth, or intense dread MUST be KEPT as "horror-adjacent" or "pure-horror". Never hide games merely because they feature weapons, action combat, or high production values.
2. HIDE (isHorror = false, classification = "non-horror"):
   - Pure non-horror genres that have spurious/joke horror tags (e.g., standard sports, casual match-3, wholesome puzzle, standard racing, non-spooky educational, plain comedy, non-horror anime dating sims).
   - Non-game assets (soundtracks, wallpapers, sound packs, engine demos, project templates, calculators).

Respond strictly in pure valid JSON matching this schema:
{
  "isHorror": boolean,
  "classification": "pure-horror" | "horror-adjacent" | "non-horror",
  "verdict": "KEEP" | "HIDE",
  "scareRating": number, // Overall 0-100 scare intensity score (0 if non-horror)
  "scareProfile": {
    "dread": number, // 0-100: Foreboding, oppressive atmosphere, slow-burn dread
    "jumpscare": number, // 0-100: Sudden shock, screeching stingers, startled reflexes
    "psychological": number, // 0-100: Mental torment, unreliable reality, existential despair
    "gore": number, // 0-100: Visceral mutilation, blood, grotesque body horror
    "tension": number, // 0-100: High-stakes panic, chase sequences, limited resources
    "disturbing": number, // 0-100: Uncanny, taboo, lingering moral or sensory disgust
    "isolation": number, // 0-100: Solitude, claustrophobia, helpless abandonment
    "shortSummary": "A punchy 1-2 sentence description of what makes this game frightening or why it is non-horror",
    "playerWarnings": ["string"], // e.g. ["Severe jump scares", "Claustrophobia"] or []
    "subFeelings": ["string"] // e.g. ["analog-horror", "cosmic-dread", "retro-ps1", "liminal"] or []
  },
  "reason": "Clear explanation of why this game is KEPT or HIDDEN"
}`;

  const res = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content: "You are an expert horror game analyst. Always output pure valid JSON without markdown formatting or code blocks.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content?.trim() || "{}";

  // Strip reasoning / think / analysis blocks
  let cleanJson = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  // Extract the outermost JSON object
  const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanJson = jsonMatch[0];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    console.warn(`   ⚠️ JSON.parse syntax hiccup on "${game.title}". Engaging resilient regex extractor...`);
    const getNum = (key: string, def = 50): number => {
      const m = cleanJson.match(new RegExp(`"${key}"\\s*:\\s*([0-9.]+)`));
      return m ? parseFloat(m[1]) : def;
    };
    const getBool = (key: string, def = true): boolean => {
      const m = cleanJson.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`, "i"));
      return m ? m[1].toLowerCase() === "true" : def;
    };
    const getStr = (key: string, def = ""): string => {
      const m = cleanJson.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\r\\n]+)`));
      return m ? m[1].replace(/\\/g, "").trim() : def;
    };
    const getArr = (key: string): string[] => {
      const m = cleanJson.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`));
      if (!m) return [];
      return m[1].split(",").map((s) => s.replace(/["'\r\n]/g, "").trim()).filter(Boolean);
    };

    parsed = {
      isHorror: getBool("isHorror", true),
      classification: getStr("classification", "horror-adjacent"),
      verdict: getStr("verdict", "KEEP"),
      scareRating: getNum("scareRating", 75),
      scareProfile: {
        dread: getNum("dread", 75),
        jumpscare: getNum("jumpscare", 50),
        psychological: getNum("psychological", 75),
        gore: getNum("gore", 50),
        tension: getNum("tension", 75),
        disturbing: getNum("disturbing", 65),
        isolation: getNum("isolation", 60),
        shortSummary: getStr("shortSummary", game.summary?.slice(0, 150) || "Atmospheric horror experience"),
        playerWarnings: getArr("playerWarnings"),
        subFeelings: getArr("subFeelings"),
      },
      reason: getStr("reason", "Curated by resilient extractor"),
    };
  }

  // Normalize scareProfile schema across model variations
  const profile = parsed.scareProfile || {};
  const normalizedProfile: ScareProfilePayload = {
    dread: Number(profile.dread ?? 50),
    jumpscare: Number(profile.jumpscare ?? 50),
    psychological: Number(profile.psychological ?? 50),
    gore: Number(profile.gore ?? 50),
    tension: Number(profile.tension ?? 50),
    disturbing: Number(profile.disturbing ?? 50),
    isolation: Number(profile.isolation ?? 50),
    shortSummary: profile.shortSummary || parsed.shortSummary || game.summary?.slice(0, 150) || "",
    playerWarnings: profile.playerWarnings || parsed.playerWarnings || [],
    subFeelings: profile.subFeelings || parsed.subFeelings || ["atmospheric"],
  };

  return {
    id: game.id,
    title: game.title,
    isHorror: parsed.isHorror ?? true,
    classification: parsed.classification ?? "pure-horror",
    scareRating: Number(parsed.scareRating ?? 50),
    scareProfile: normalizedProfile,
    reason: parsed.reason || "",
  };
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 10;
  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10);
    }
  }

  console.log("\n==================================================");
  console.log(`🔥 PASS 2 DEEP ENRICHMENT & VERIFICATION WORKER`);
  console.log(`🤖 Active Model: ${MODEL_NAME}`);
  console.log(`🎯 Batch Limit:  ${limit} games`);
  console.log("==================================================\n");

  const dataDir = path.resolve(process.cwd(), "scripts/horror-audit/data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const checkpointPath = path.join(dataDir, "pass2_checkpoint.json");
  let processedIds = new Set<string>();
  if (fs.existsSync(checkpointPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
      processedIds = new Set(data.processed || []);
    } catch {}
  }

  // Fetch games where scareRating IS NULL and status is 'released'
  const res = await rawDb.execute(
    `SELECT id, title, summary, source, developerNames FROM "Game" WHERE "scareRating" IS NULL AND status = 'released' LIMIT ${Math.max(limit * 5, 100)}`
  );

  const candidates = res.rows.filter((r) => !processedIds.has(r.id as string)).slice(0, limit);
  console.log(`📋 Found ${candidates.length} unenriched games to process.\n`);

  let successCount = 0;
  let hiddenCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const game = candidates[i];
    console.log(`[${i + 1}/${candidates.length}] 🎮 Evaluating: "${game.title}" (${game.developerNames || "Unknown"})`);

    const t0 = Date.now();
    try {
      // 1. Multi-site search context
      const { context, redditUrl } = await fetchMultiSiteContext(game.title as string, game.developerNames as string);

      // 2. Model inference
      const result = await analyzeWithModel(game, context);
      if (redditUrl) result.redditUrl = redditUrl;

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      // 3. Handle verdict
      if (!result.isHorror || result.classification === "non-horror") {
        console.log(`   🚫 Flagged Non-Horror! Soft-hiding: "${game.title}" (Reason: ${result.reason.slice(0, 80)}...) [${elapsed}s]`);
        await rawDb.execute({
          sql: `UPDATE "Game" SET status = 'hidden', "updatedAt" = unixepoch() WHERE id = ?`,
          args: [game.id],
        });
        hiddenCount++;

        // Save to hidden audit log
        const hiddenLogPath = path.join(dataDir, "pass2_hidden_log.json");
        let hiddenLogs: any[] = [];
        if (fs.existsSync(hiddenLogPath)) {
          try { hiddenLogs = JSON.parse(fs.readFileSync(hiddenLogPath, "utf-8")); } catch {}
        }
        hiddenLogs.push({
          id: game.id,
          title: game.title,
          developer: game.developerNames,
          reason: result.reason,
          hiddenAt: new Date().toISOString()
        });
        fs.writeFileSync(hiddenLogPath, JSON.stringify(hiddenLogs, null, 2));
      } else {
        console.log(`   ✅ Enriched Horror (${result.classification}): Scare Score ${result.scareRating}/100 [${elapsed}s]`);
        console.log(`      Tags: ${result.scareProfile.subFeelings.slice(0, 4).join(", ")}`);
        if (result.redditUrl) console.log(`      Reddit: ${result.redditUrl}`);

        await rawDb.execute({
          sql: `UPDATE "Game" SET "scareRating" = ?, "scareProfile" = ?, "redditUrl" = COALESCE(?, "redditUrl"), "lastScareSync" = unixepoch() WHERE id = ?`,
          args: [result.scareRating, JSON.stringify(result.scareProfile), result.redditUrl || null, game.id],
        });
        successCount++;
      }

      processedIds.add(game.id as string);
      fs.writeFileSync(checkpointPath, JSON.stringify({ processed: Array.from(processedIds), lastUpdated: new Date().toISOString() }, null, 2));

      // Small pause to allow socket cleanup
      await sleep(500);
    } catch (err: any) {
      console.error(`   ❌ Error on "${game.title}": ${err.message}`);
    }
  }

  console.log("\n==================================================");
  console.log("🏁 BATCH COMPLETE");
  console.log(`✨ Enriched & Verified: ${successCount}`);
  console.log(`🚫 Non-Horror Hidden:   ${hiddenCount}`);
  console.log(`📦 Checkpoint Total:    ${processedIds.size}`);
  console.log("==================================================\n");
}

main().catch(console.error);
