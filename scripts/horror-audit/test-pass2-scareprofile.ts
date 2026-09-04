import "../load-env";
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

async function fetchMultiSiteContext(title: string, developer?: string): Promise<{ context: string; redditUrl?: string }> {
  const query = `${title} ${developer ? `by ${developer}` : ""} horror game scary discussion reddit review`;
  let context = "";
  let redditUrl: string | undefined;

  // 1. Query Tavily with Reddit, Itch, Steam priority
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "basic",
          max_results: 4,
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
      console.warn("Tavily error:", e.message);
    }
  }

  // 2. Query Exa as fallback/supplement if context is low
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
      console.warn("Exa error:", e.message);
    }
  }

  return { context, redditUrl };
}

async function analyzeWithLMStudio(game: any, searchContext: string): Promise<Pass2Result> {
  const prompt = `You are the lead game critic and horror psychologist for Gamegata.
Analyze this game and compute its exact 7-dimensional Scare Profile for our UI:

Game Details:
- Title: ${game.title}
- Developer: ${game.developerNames || "Unknown"}
- Database Summary: ${game.summary || "None"}
- Multi-site Web & Reddit Context:
${searchContext || "No external search data found."}

Based on Gamegata's expansive affective horror taxonomy and real player reactions on Reddit/Steam/Itch:
Respond strictly in pure valid JSON matching this schema:
{
  "isHorror": true,
  "classification": "pure-horror" | "horror-adjacent" | "non-horror",
  "scareRating": number, // Overall 0-100 scare intensity score
  "scareProfile": {
    "dread": number, // 0-100: Foreboding, oppressive atmosphere, slow-burn dread
    "jumpscare": number, // 0-100: Sudden shock, screeching stingers, startled reflexes
    "psychological": number, // 0-100: Mental torment, unreliable reality, existential despair
    "gore": number, // 0-100: Visceral mutilation, blood, grotesque body horror
    "tension": number, // 0-100: High-stakes panic, chase sequences, limited resources
    "disturbing": number, // 0-100: Uncanny, taboo, lingering moral or sensory disgust
    "isolation": number, // 0-100: Solitude, claustrophobia, helpless abandonment
    "shortSummary": "A punchy 1-2 sentence description of what makes this game frightening or unsettling",
    "playerWarnings": ["string", "string"], // e.g. ["Severe jump scares", "Claustrophobia", "Flashing visuals"]
    "subFeelings": ["string", "string"] // e.g. ["analog-horror", "cosmic-dread", "retro-ps1", "yandere-obsession", "liminal"]
  },
  "reason": "Brief editorial rationale"
}`;

  const res = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.3-8b-instruct-thinking-heretic-uncensored-claude-4.5-opus-high-reasoning-i1",
      messages: [
        {
          role: "system",
          content: "You are an expert horror game analyst. Always output pure valid JSON without markdown formatting or code blocks.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  const data = await res.json();
  console.log("LM Studio Usage:", JSON.stringify(data.usage), "Finish Reason:", data.choices[0]?.finish_reason);
  const rawText = data.choices[0]?.message?.content?.trim() || "{}";
  
  // Strip any reasoning / think / analysis blocks
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

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      id: game.id,
      title: game.title,
      ...parsed,
    };
  } catch (err) {
    console.error("Failed to parse JSON. Raw text was:\n", rawText.slice(0, 500));
    throw err;
  }
}

async function main() {
  console.log("\n==================================================");
  console.log("🔥 PASS 2 DEEP ENRICHMENT & SCARE PROFILE TEST");
  console.log("==================================================");

  // Pick a game that currently lacks a scare profile
  const res = await rawDb.execute(
    `SELECT id, title, summary, source, developerNames FROM "Game" WHERE "scareRating" IS NULL AND status = 'released' LIMIT 1`
  );
  const game = res.rows[0];

  console.log(`🎮 Game: ${game.title} (${game.source}) by ${game.developerNames || "Unknown"}`);
  console.log(`📖 DB Summary: ${(game.summary as string)?.slice(0, 90) || "None"}...`);

  console.log("\n🌐 Fetching Multi-Site & Reddit Context via Tavily/Exa...");
  const { context, redditUrl } = await fetchMultiSiteContext(game.title as string, game.developerNames as string);
  console.log(`💬 Found Reddit discussion: ${redditUrl || "None"}`);
  console.log(`📄 Context snippet: ${context.slice(0, 150)}...\n`);

  console.log("🧠 Analyzing with Local LM Studio (Qwen 3.5 Heretic Uncensored)...");
  const t0 = Date.now();
  const result = await analyzeWithLMStudio(game, context);
  if (redditUrl) result.redditUrl = redditUrl;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  console.log(`\n⚡ Complete in ${elapsed}s:`);
  console.log(JSON.stringify(result, null, 2));

  if (result.isHorror && result.scareProfile) {
    await rawDb.execute({
      sql: `UPDATE "Game" SET "scareRating" = ?, "scareProfile" = ?, "redditUrl" = COALESCE(?, "redditUrl"), "lastScareSync" = unixepoch() WHERE id = ?`,
      args: [result.scareRating, JSON.stringify(result.scareProfile), result.redditUrl || null, game.id],
    });
    console.log(`\n💾 Successfully enriched TursoDB for "${game.title}"!`);
  }
}

main().catch(console.error);
