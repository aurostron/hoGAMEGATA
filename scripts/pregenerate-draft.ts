import { turso, schema, desc, and, or, isNull, ne, like } from "./db-helper";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// Simple command line arguments parser
const args = process.argv.slice(2);
let provider = "freellmapi";
let limit = 15;
let offset = 0;
let modelOverride: string | null = null;

for (const arg of args) {
  if (arg.startsWith("--provider=")) {
    provider = arg.split("=")[1];
  } else if (arg.startsWith("--limit=")) {
    limit = parseInt(arg.split("=")[1], 10) || 15;
  } else if (arg.startsWith("--offset=")) {
    offset = parseInt(arg.split("=")[1], 10) || 0;
  } else if (arg.startsWith("--model=")) {
    modelOverride = arg.split("=")[1];
  }
}

if (provider !== "local" && provider !== "freellmapi") {
  console.error("❌ Error: Invalid --provider. Must be 'local' or 'freellmapi'.");
  process.exit(1);
}

// Map credentials based on selected provider
let baseURL = "http://localhost:3001/v1";
let apiKey = process.env.FREELLM_API_KEY || "dummy-key";
let model = "auto";

if (provider === "local") {
  baseURL = process.env.LOCAL_AI_BASE_URL || "http://localhost:11434/v1";
  apiKey = process.env.LOCAL_AI_API_KEY || "ollama";
  model = modelOverride || process.env.LOCAL_AI_MODEL || "qwen2.5";
} else {
  // freellmapi
  baseURL = "http://localhost:3001/v1";
  apiKey = process.env.FREELLM_API_KEY || "dummy-key";
  model = modelOverride || "auto";
}

// Proxy configuration for FreeLLMAPI if needed
if (provider === "freellmapi" && process.env.PROXY_URL) {
  process.env.HTTPS_PROXY = process.env.PROXY_URL;
  process.env.HTTP_PROXY = process.env.PROXY_URL;
}

const client = new OpenAI({
  baseURL,
  apiKey,
});

const DRAFT_FILE_PATH = path.join(process.cwd(), "pending-search-cache.json");

async function main() {
  console.log(`🤖 Starting pre-generation draft pipeline...`);
  console.log(`📡 Provider: \x1b[36m${provider}\x1b[0m | Endpoint: \x1b[32m${baseURL}\x1b[0m | Model: \x1b[33m${model}\x1b[0m`);
  console.log(`📊 Limit: ${limit} | Offset: ${offset}\n`);

  // 1. Load existing draft cache if it exists
  let draftData: Record<string, { query: string; llm_suggestions: string[]; db_verified: string[] }> = {};
  if (fs.existsSync(DRAFT_FILE_PATH)) {
    try {
      draftData = JSON.parse(fs.readFileSync(DRAFT_FILE_PATH, "utf8"));
      console.log(`📂 Loaded existing draft file with ${Object.keys(draftData).length} cached queries.`);
    } catch (e) {
      console.warn("⚠️ Warning: Failed to parse existing draft file. Starting fresh.");
    }
  }

  // 2. Fetch top horror games sorted by popularity
  console.log(`📥 Loading games from database...`);
  const gamesList = await turso
    .select({
      id: schema.games.id,
      title: schema.games.title,
      popularity: schema.games.popularity,
    })
    .from(schema.games)
    .where(or(isNull(schema.games.status), ne(schema.games.status, "hidden")))
    .orderBy(desc(schema.games.popularity))
    .limit(limit)
    .offset(offset);

  console.log(`🎮 Found ${gamesList.length} games to process.`);

  let processedCount = 0;

  for (const game of gamesList) {
    const queryKey = `games like ${game.title.toLowerCase().trim()}`;

    // Skip if query already exists in the local draft
    if (draftData[queryKey]) {
      console.log(`⏩ Skipping "${game.title}" (already in pending-search-cache.json)`);
      continue;
    }

    console.log(`\n🔍 [${processedCount + 1}/${gamesList.length}] Finding games like: "\x1b[35m${game.title}\x1b[0m"`);

    const prompt = `You are a horror game recommendation engine.
Provide a list of up to 5 horror games that are very similar to "${game.title}" in theme, mechanics, and vibe.
Respond ONLY with a JSON object in this format:
{
  "suggested_titles": ["Game Title 1", "Game Title 2", "Game Title 3", "Game Title 4", "Game Title 5"]
}
Do not include "${game.title}" itself in the list. Do not write any explanations.`;

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const rawJson = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawJson) as { suggested_titles?: string[] };
      const suggestions = parsed.suggested_titles || [];

      console.log(`💡 LLM Suggested: [${suggestions.join(", ")}]`);

      // Grounding Check: Verify each suggested game exists in the database
      const dbVerified: string[] = [];

      for (const title of suggestions) {
        if (!title) continue;
        if (title.toLowerCase().trim() === game.title.toLowerCase().trim()) continue;

        // Try exact match
        const [exact] = await turso
          .select({ title: schema.games.title })
          .from(schema.games)
          .where(and(
            like(schema.games.title, title.trim()),
            or(isNull(schema.games.status), ne(schema.games.status, "hidden"))
          ))
          .limit(1);

        if (exact) {
          dbVerified.push(exact.title);
        } else {
          // Try approximate match
          const [approx] = await turso
            .select({ title: schema.games.title })
            .from(schema.games)
            .where(and(
              like(schema.games.title, `%${title.trim()}%`),
              or(isNull(schema.games.status), ne(schema.games.status, "hidden"))
            ))
            .limit(1);
          if (approx && approx.title !== game.title) {
            dbVerified.push(approx.title);
          }
        }
      }

      console.log(`✅ DB Verified: \x1b[32m[${dbVerified.join(", ")}]\x1b[0m`);

      // Write to draft cache
      draftData[queryKey] = {
        query: `games like ${game.title.toLowerCase().trim()}`,
        llm_suggestions: suggestions,
        db_verified: dbVerified,
      };

      // Save file after each game to prevent data loss
      fs.writeFileSync(DRAFT_FILE_PATH, JSON.stringify(draftData, null, 2), "utf8");
      processedCount++;

      // Prevent local AI spamming block
      await new Promise((r) => setTimeout(r, 600));

    } catch (err) {
      console.error(`❌ Failed to process "${game.title}":`, err);
      // Wait longer on error before next try
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n🎉 Processed ${processedCount} new games. Draft file updated at: ${DRAFT_FILE_PATH}`);
  console.log(`👉 Open "pending-search-cache.json" to review, edit, or delete any incorrect matches.`);
  console.log(`🚀 Run "npm run apply-search-cache" to push verified results to your database!`);
}

main().catch(err => {
  console.error("❌ Fatal pregenerate-draft error:", err);
  process.exit(1);
});
