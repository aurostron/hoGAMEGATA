import "dotenv/config";
import { turso, initTursoForRequest } from "../src/lib/turso";
initTursoForRequest(process.env);
import {
  games as gamesTable,
  developers as developersTable,
  gamesToDevelopers,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

export interface SearchIndexRecord {
  i: string;           // id
  t: string;           // title
  s: string;           // slug
  c: string | null;    // coverUrl
  d: string[];         // developers
}

async function generateSearchIndex() {
  console.log("🚀 Generating minimal search index for mini search bar...");
  const startTime = Date.now();

  // 1. Fetch active games
  const rawGames = await turso
    .select({
      id: gamesTable.id,
      title: gamesTable.title,
      slug: gamesTable.slug,
      coverUrl: gamesTable.coverUrl,
      status: gamesTable.status,
    })
    .from(gamesTable);

  const visibleGames = rawGames.filter(g => g.status !== "hidden");
  console.log(`📦 Found ${visibleGames.length} active games in Turso.`);

  // 2. Fetch developers mapping
  const allDevs = await turso
    .select({
      gameId: gamesToDevelopers.gameId,
      name: developersTable.name,
    })
    .from(gamesToDevelopers)
    .innerJoin(developersTable, eq(gamesToDevelopers.developerId, developersTable.id));

  const devsMap = new Map<string, string[]>();
  allDevs.forEach(({ gameId, name }) => {
    const key = String(gameId);
    if (!devsMap.has(key)) devsMap.set(key, []);
    devsMap.get(key)!.push(name);
  });

  // 3. Assemble minimal search records
  const searchRecords: SearchIndexRecord[] = visibleGames.map(game => {
    const idKey = String(game.id);
    return {
      i: idKey,
      t: game.title,
      s: game.slug,
      c: game.coverUrl || null,
      d: devsMap.get(idKey) || [],
    };
  });

  // 4. Output to public/search-index.json
  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, "search-index.json");
  const jsonContent = JSON.stringify(searchRecords);
  fs.writeFileSync(outputPath, jsonContent, "utf8");

  const sizeKb = (Buffer.byteLength(jsonContent, "utf8") / 1024).toFixed(1);
  const elapsed = Date.now() - startTime;
  console.log(`✅ Generated ${outputPath} (${searchRecords.length} records, ${sizeKb} KB) in ${elapsed}ms.`);
}

generateSearchIndex().catch(err => {
  const outputPath = path.join(process.cwd(), "public", "search-index.json");
  if (fs.existsSync(outputPath)) {
    console.warn("⚠️ Database offline/blocked. Preserving existing public/search-index.json file.");
    process.exit(0);
  } else {
    console.error("❌ Failed to generate search index:", err);
    process.exit(1);
  }
});
