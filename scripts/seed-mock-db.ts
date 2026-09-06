import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const dbPath = path.resolve(process.cwd(), "local.db");
  console.log(`[seed-mock] Initializing local SQLite database at: ${dbPath}`);

  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // ignore
    }
  }

  const client = createClient({
    url: `file:${dbPath}`,
  });

  console.log("[seed-mock] Ensuring relational schema tables exist...");

  await client.execute(`DROP TABLE IF EXISTS "Game"`);
  await client.execute(`DROP TABLE IF EXISTS "Developer"`);
  await client.execute(`DROP TABLE IF EXISTS "Publisher"`);
  await client.execute(`DROP TABLE IF EXISTS "Genre"`);
  await client.execute(`DROP TABLE IF EXISTS "Tag"`);
  await client.execute(`DROP TABLE IF EXISTS "Platform"`);
  await client.execute(`DROP TABLE IF EXISTS "_DeveloperToGame"`);
  await client.execute(`DROP TABLE IF EXISTS "_GameToPublisher"`);
  await client.execute(`DROP TABLE IF EXISTS "_GameToGenre"`);
  await client.execute(`DROP TABLE IF EXISTS "_GameToTag"`);
  await client.execute(`DROP TABLE IF EXISTS "_GameToPlatform"`);
  await client.execute(`DROP TABLE IF EXISTS "PriceSnapshot"`);
  await client.execute(`DROP TABLE IF EXISTS "PurchaseLink"`);

  await client.execute(`
    CREATE TABLE "Developer" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL,
      "avatarUrl" TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE "Publisher" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE "Genre" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE "Tag" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE "Platform" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE "Game" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER,
      "title" TEXT NOT NULL,
      "slug" TEXT UNIQUE NOT NULL,
      "summary" TEXT,
      "storyline" TEXT,
      "releaseDate" INTEGER,
      "status" TEXT,
      "coverUrl" TEXT,
      "rating" REAL,
      "trailerUrl" TEXT,
      "screenshots" TEXT,
      "catboxAlbumId" TEXT,
      "likesCount" INTEGER DEFAULT 0 NOT NULL,
      "isTrending" INTEGER DEFAULT 0 NOT NULL,
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL,
      "metacritic" INTEGER,
      "metacriticUrl" TEXT,
      "playtime" INTEGER,
      "esrbRating" TEXT,
      "pegiRating" TEXT,
      "redditUrl" TEXT,
      "websiteUrl" TEXT,
      "rawgRating" REAL,
      "rawgSlug" TEXT,
      "rawgEnriched" INTEGER DEFAULT 0 NOT NULL,
      "rawgId" INTEGER,
      "lastRawgSync" INTEGER,
      "rawgMetadataHash" TEXT,
      "steamRating" REAL,
      "steamRatingDesc" TEXT,
      "lastSteamSync" INTEGER,
      "scareRating" REAL,
      "scareProfile" TEXT,
      "scareReviewCount" INTEGER,
      "lastScareSync" INTEGER,
      "protonDbTier" TEXT,
      "protonDbConfidence" TEXT,
      "protonDbScore" REAL,
      "protonDbTotalReports" INTEGER,
      "lastProtonDbSync" INTEGER,
      "category" INTEGER,
      "minRequirements" TEXT,
      "recRequirements" TEXT,
      "popularity" REAL,
      "developerNames" TEXT,
      "publisherNames" TEXT,
      "genreNames" TEXT,
      "platformNames" TEXT,
      "multiplayer" TEXT,
      "controllerSupport" TEXT,
      "vrSupport" TEXT,
      "source" TEXT,
      "taxonomyScores" TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE "PriceSnapshot" (
      "id" TEXT PRIMARY KEY,
      "gameId" TEXT NOT NULL,
      "storeName" TEXT NOT NULL,
      "dealPrice" REAL NOT NULL,
      "retailPrice" REAL NOT NULL,
      "discountPercent" REAL NOT NULL,
      "dealUrl" TEXT NOT NULL,
      "currency" TEXT DEFAULT 'USD' NOT NULL,
      "country" TEXT DEFAULT 'US' NOT NULL,
      "provider" TEXT DEFAULT 'direct' NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE "PurchaseLink" (
      "id" TEXT PRIMARY KEY,
      "gameId" TEXT NOT NULL,
      "storeName" TEXT NOT NULL,
      "url" TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE "_DeveloperToGame" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE "_GameToPublisher" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE "_GameToGenre" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE "_GameToTag" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE "_GameToPlatform" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  const jsonPath = path.resolve(process.cwd(), "data", "curated-100-games.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Curated data file not found at: ${jsonPath}`);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`[seed-mock] Seeding ${data.games.length} curated horror games...`);

  const batchInsert = async (table: string, columns: string[], rows: any[]) => {
    if (rows.length === 0) return;
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const stmts = chunk.map(row => ({
        sql: `INSERT OR REPLACE INTO "${table}" (${columns.map(c => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
        args: columns.map(c => {
          let val = row[c];
          if (c === "updatedAt" && (val === undefined || val === null)) {
            val = Math.floor(Date.now() / 1000);
          }
          if (c === "createdAt" && (val === undefined || val === null)) {
            val = Math.floor(Date.now() / 1000);
          }
          return val === undefined ? null : val;
        })
      }));
      await client.batch(stmts, "write");
    }
  };

  await batchInsert("Developer", ["id", "igdbId", "name", "slug", "avatarUrl"], data.developers);
  await batchInsert("Publisher", ["id", "igdbId", "name", "slug"], data.publishers);
  await batchInsert("Genre", ["id", "igdbId", "name", "slug"], data.genres);
  await batchInsert("Tag", ["id", "name", "slug"], data.tags);
  await batchInsert("Platform", ["id", "igdbId", "name", "slug"], data.platforms);

  const gameCols = [
    "id", "igdbId", "title", "slug", "summary", "storyline", "releaseDate", "status",
    "coverUrl", "rating", "trailerUrl", "screenshots", "catboxAlbumId", "likesCount",
    "isTrending", "createdAt", "updatedAt", "metacritic", "metacriticUrl", "playtime",
    "esrbRating", "pegiRating", "redditUrl", "websiteUrl", "rawgRating", "rawgSlug",
    "rawgEnriched", "rawgId", "lastRawgSync", "rawgMetadataHash", "steamRating",
    "steamRatingDesc", "lastSteamSync", "scareRating", "scareProfile", "scareReviewCount",
    "lastScareSync", "protonDbTier", "protonDbConfidence", "protonDbScore",
    "protonDbTotalReports", "lastProtonDbSync", "category", "minRequirements",
    "recRequirements", "popularity", "developerNames", "publisherNames", "genreNames",
    "platformNames", "multiplayer", "controllerSupport", "vrSupport", "source", "taxonomyScores"
  ];
  await batchInsert("Game", gameCols, data.games);

  await batchInsert("_DeveloperToGame", ["A", "B"], data.gameToDevs);
  await batchInsert("_GameToPublisher", ["A", "B"], data.gameToPubs);
  await batchInsert("_GameToGenre", ["A", "B"], data.gameToGenres);
  await batchInsert("_GameToTag", ["A", "B"], data.gameToTags);
  await batchInsert("_GameToPlatform", ["A", "B"], data.gameToPlatforms);

  await batchInsert("PriceSnapshot", [
    "id", "gameId", "storeName", "dealPrice", "retailPrice", "discountPercent",
    "dealUrl", "currency", "country", "provider", "updatedAt"
  ], data.priceSnapshots);

  await batchInsert("PurchaseLink", ["id", "gameId", "storeName", "url"], data.purchaseLinks);

  console.log("[seed-mock] Building indexes...");
  await client.execute(`CREATE INDEX IF NOT EXISTS "idx_game_slug" ON "Game"("slug")`);
  await client.execute(`CREATE INDEX IF NOT EXISTS "idx_game_title" ON "Game"("title")`);
  await client.execute(`CREATE INDEX IF NOT EXISTS "idx_game_rating" ON "Game"("rating")`);
  await client.execute(`CREATE INDEX IF NOT EXISTS "idx_game_release_date" ON "Game"("releaseDate")`);
  await client.execute(`CREATE INDEX IF NOT EXISTS "idx_game_trending" ON "Game"("isTrending", "popularity")`);

  console.log("=================================================");
  console.log(" Curated Horror Games Database Initialized Successfully!");
  console.log(` - ${data.games.length} Iconic Horror games seeded`);
  console.log(` - ${data.developers.length} Developers, ${data.publishers.length} Publishers`);
  console.log(` - ${data.genres.length} Genres, ${data.tags.length} Tags, ${data.platforms.length} Platforms`);
  console.log(` - ${data.priceSnapshots.length} Price Snapshots, ${data.purchaseLinks.length} Store Links`);
  console.log(` - Location: ./local.db`);
  console.log("=================================================");
}

main().catch(err => {
  console.error("[seed-mock] Failed to seed database:", err);
  process.exit(1);
});
