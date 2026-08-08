import "dotenv/config";
import { turso, initTursoForRequest } from "../src/lib/turso";
initTursoForRequest(process.env);
import {
  games as gamesTable,
  developers as developersTable,
  gamesToDevelopers,
  genres as genresTable,
  gamesToGenres
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

export interface SearchIndexRecord {
  i: number;           // id
  t: string;           // title
  s: string;           // slug
  c: string | null;    // coverUrl
  r: number | null;    // rating
  sr: number | null;   // steamRating
  sc: number | null;   // scareRating
  y: number | null;    // releaseYear
  d: string[];         // developers
  g: string[];         // genres
}

async function generateSearchIndex() {
  console.log("🚀 Generating compact search index for desktop native search...");
  const startTime = Date.now();

  // 1. Fetch all games
  const rawGames = await turso
    .select({
      id: gamesTable.id,
      title: gamesTable.title,
      slug: gamesTable.slug,
      coverUrl: gamesTable.coverUrl,
      rating: gamesTable.rating,
      steamRating: gamesTable.steamRating,
      scareRating: gamesTable.scareRating,
      releaseDate: gamesTable.releaseDate,
      status: gamesTable.status,
    })
    .from(gamesTable);

  const visibleGames = rawGames.filter(g => g.status !== "hidden");
  console.log(`📦 Found ${visibleGames.length} active games in Turso.`);

  // 2. Fetch developers and genres mapping
  const [allDevs, allGenres] = await Promise.all([
    turso
      .select({
        gameId: gamesToDevelopers.gameId,
        name: developersTable.name,
      })
      .from(gamesToDevelopers)
      .innerJoin(developersTable, eq(gamesToDevelopers.developerId, developersTable.id)),
    turso
      .select({
        gameId: gamesToGenres.gameId,
        name: genresTable.name,
      })
      .from(gamesToGenres)
      .innerJoin(genresTable, eq(gamesToGenres.genreId, genresTable.id))
  ]);

  const devsMap = new Map<number, string[]>();
  allDevs.forEach(({ gameId, name }) => {
    if (!devsMap.has(gameId)) devsMap.set(gameId, []);
    devsMap.get(gameId)!.push(name);
  });

  const genresMap = new Map<number, string[]>();
  allGenres.forEach(({ gameId, name }) => {
    if (!genresMap.has(gameId)) genresMap.set(gameId, []);
    genresMap.get(gameId)!.push(name);
  });

  // 3. Assemble compact search records
  const searchRecords: SearchIndexRecord[] = visibleGames.map(game => {
    let year: number | null = null;
    if (game.releaseDate) {
      const d = new Date(game.releaseDate);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
        year = d.getFullYear();
      }
    }

    return {
      i: game.id,
      t: game.title,
      s: game.slug,
      c: game.coverUrl || null,
      r: game.rating || null,
      sr: game.steamRating || null,
      sc: game.scareRating || null,
      y: year,
      d: devsMap.get(game.id) || [],
      g: genresMap.get(game.id) || [],
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
  console.error("❌ Failed to generate search index:", err);
  process.exit(1);
});
