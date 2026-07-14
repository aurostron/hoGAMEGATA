import { turso, schema, inArray, or, isNull, ne } from "./db-helper";
import { enrichGamesWithRelations } from "../src/lib/gameQueries";
import * as fs from "fs";
import * as path from "path";

const DRAFT_FILE_PATH = path.join(process.cwd(), "pending-search-cache.json");

// Helper to slugify query to unique ID
function slugifyQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("⚡ Starting database search cache application script...");

  if (!fs.existsSync(DRAFT_FILE_PATH)) {
    console.error(`❌ Error: Draft file "${DRAFT_FILE_PATH}" not found. Run pregenerate-draft first.`);
    process.exit(1);
  }

  let draftData: Record<string, { query: string; llm_suggestions: string[]; db_verified: string[] }> = {};
  try {
    draftData = JSON.parse(fs.readFileSync(DRAFT_FILE_PATH, "utf8"));
  } catch (e) {
    console.error("❌ Error: Failed to parse pending-search-cache.json.");
    process.exit(1);
  }

  const queries = Object.keys(draftData);
  if (queries.length === 0) {
    console.log("ℹ️ No queries found in draft file.");
    process.exit(0);
  }

  console.log(`📁 Loaded ${queries.length} queries from draft file.`);
  console.log("🔄 Resolving game details and writing to database cache...\n");

  let appliedCount = 0;

  for (const key of queries) {
    const entry = draftData[key];
    if (!entry.db_verified || entry.db_verified.length === 0) {
      console.log(`⚠️ Skipping "${entry.query}" (no verified games resolved)`);
      continue;
    }

    const querySlug = slugifyQuery(entry.query);

    try {
      // 1. Fetch raw games matching the verified titles
      const rawGames = await turso
        .select()
        .from(schema.games)
        .where(and(
          inArray(schema.games.title, entry.db_verified),
          or(isNull(schema.games.status), ne(schema.games.status, "hidden"))
        ));

      if (rawGames.length === 0) {
        console.warn(`⚠️ Warning: Could not find any of the verified titles for "${entry.query}" in DB.`);
        continue;
      }

      // 2. Sort to match original verified list order
      const titleToIndex = new Map(entry.db_verified.map((t, idx) => [t.toLowerCase().trim(), idx]));
      rawGames.sort((a, b) => {
        const idxA = titleToIndex.get(a.title.toLowerCase().trim()) ?? 99;
        const idxB = titleToIndex.get(b.title.toLowerCase().trim()) ?? 99;
        return idxA - idxB;
      });

      // 3. Enrich games with platforms, devs, genres, snapshots (saves 100% of runtime lookup queries)
      const enrichedGames = await enrichGamesWithRelations(rawGames);

      // 4. Upsert into database
      await turso
        .insert(schema.aiSearchCache)
        .values({
          id: querySlug,
          query: entry.query.toLowerCase().trim(),
          resultsJson: JSON.stringify(enrichedGames),
        })
        .onConflictDoUpdate({
          target: schema.aiSearchCache.id,
          set: {
            resultsJson: JSON.stringify(enrichedGames),
          },
        });

      console.log(`✅ Applied cache for: "\x1b[36m${entry.query}\x1b[0m" (\x1b[32m${enrichedGames.length} games\x1b[0m)`);
      appliedCount++;

    } catch (err) {
      console.error(`❌ Failed to apply cache for "${entry.query}":`, err);
    }
  }

  console.log(`\n🎉 Success! Applied ${appliedCount} search cache entries directly to Turso.`);
}

import { and } from "drizzle-orm";

main().catch(err => {
  console.error("❌ Fatal apply-search-cache error:", err);
  process.exit(1);
});
