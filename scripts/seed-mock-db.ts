import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";

interface MockSeedData {
  developers: Array<{ id: string; igdbId?: number; name: string; slug: string; avatarUrl?: string }>;
  publishers: Array<{ id: string; igdbId?: number; name: string; slug: string }>;
  genres: Array<{ id: string; igdbId?: number; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  platforms: Array<{ id: string; igdbId?: number; name: string; slug: string }>;
  games: Array<{
    id: string;
    igdbId?: number;
    title: string;
    slug: string;
    summary?: string;
    storyline?: string;
    releaseDate?: number;
    status?: string;
    coverUrl?: string;
    rating?: number;
    popularity?: number;
    likesCount?: number;
    isTrending?: boolean;
    steamRating?: number;
    steamRatingDesc?: string;
    developerNames?: string;
    publisherNames?: string;
    genreNames?: string;
    platformNames?: string;
    developerIds?: string[];
    publisherIds?: string[];
    genreIds?: string[];
    tagIds?: string[];
    platformIds?: string[];
    dealPrice?: number;
    regularPrice?: number;
  }>;
}

async function main() {
  const dbPath = path.resolve(process.cwd(), "local.db");
  console.log(`[seed-mock] Initializing local SQLite database at: ${dbPath}`);

  const client = createClient({
    url: `file:${dbPath}`,
  });

  // 1. Ensure core relational tables exist
  console.log("[seed-mock] Ensuring relational schema tables exist...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Developer" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL,
      "avatarUrl" TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Publisher" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Genre" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Tag" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT UNIQUE NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Platform" (
      "id" TEXT PRIMARY KEY,
      "igdbId" INTEGER UNIQUE,
      "name" TEXT NOT NULL,
      "slug" TEXT UNIQUE NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Game" (
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
    CREATE TABLE IF NOT EXISTS "PriceSnapshot" (
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
    CREATE TABLE IF NOT EXISTS "_DeveloperToGame" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_GameToGenre" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_GameToTag" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_GameToPlatform" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_GameToPublisher" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      PRIMARY KEY ("A", "B")
    );
  `);

  // Ensure all modern columns exist on "Game" in case local.db was created with an older schema
  const existingColsRes = await client.execute('PRAGMA table_info("Game");');
  const existingCols = new Set(existingColsRes.rows.map((r: any) => String(r.name)));

  const optionalColumns: Record<string, string> = {
    likesCount: 'INTEGER DEFAULT 0 NOT NULL',
    isTrending: 'INTEGER DEFAULT 0 NOT NULL',
    steamRating: 'REAL',
    steamRatingDesc: 'TEXT',
    lastSteamSync: 'INTEGER',
    scareRating: 'REAL',
    scareProfile: 'TEXT',
    scareReviewCount: 'INTEGER',
    lastScareSync: 'INTEGER',
    protonDbTier: 'TEXT',
    protonDbConfidence: 'TEXT',
    protonDbScore: 'REAL',
    protonDbTotalReports: 'INTEGER',
    lastProtonDbSync: 'INTEGER',
    category: 'INTEGER',
    minRequirements: 'TEXT',
    recRequirements: 'TEXT',
    popularity: 'REAL',
    developerNames: 'TEXT',
    publisherNames: 'TEXT',
    genreNames: 'TEXT',
    platformNames: 'TEXT',
    multiplayer: 'TEXT',
    controllerSupport: 'TEXT',
    vrSupport: 'TEXT',
    source: 'TEXT',
    taxonomyScores: 'TEXT',
  };

  for (const [col, colDef] of Object.entries(optionalColumns)) {
    if (!existingCols.has(col)) {
      try {
        await client.execute(`ALTER TABLE "Game" ADD COLUMN "${col}" ${colDef};`);
      } catch (err) {
        // Ignore column add error if it already exists
      }
    }
  }

  // Ensure all modern columns exist on "PriceSnapshot"
  const priceColsRes = await client.execute('PRAGMA table_info("PriceSnapshot");');
  const priceCols = new Set(priceColsRes.rows.map((r: any) => String(r.name)));
  const priceOptionalCols: Record<string, string> = {
    storeName: "TEXT DEFAULT 'Steam' NOT NULL",
    dealPrice: "REAL DEFAULT 0 NOT NULL",
    retailPrice: "REAL DEFAULT 0 NOT NULL",
    discountPercent: "REAL DEFAULT 0 NOT NULL",
    dealUrl: "TEXT DEFAULT '' NOT NULL",
    currency: "TEXT DEFAULT 'USD' NOT NULL",
    country: "TEXT DEFAULT 'US' NOT NULL",
    provider: "TEXT DEFAULT 'direct' NOT NULL",
    updatedAt: "INTEGER DEFAULT 0 NOT NULL",
  };
  for (const [col, colDef] of Object.entries(priceOptionalCols)) {
    if (!priceCols.has(col)) {
      try {
        await client.execute(`ALTER TABLE "PriceSnapshot" ADD COLUMN "${col}" ${colDef};`);
      } catch (err) {
        // Ignore column add error if it already exists
      }
    }
  }

  // 2. Read mock seed data
  const seedFile = path.resolve(process.cwd(), "data", "mock-seed.json");
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Mock seed file not found at ${seedFile}`);
  }

  const seed: MockSeedData = JSON.parse(fs.readFileSync(seedFile, "utf-8"));
  console.log(`[seed-mock] Loaded mock data: ${seed.games.length} games, ${seed.developers.length} developers, ${seed.tags.length} tags`);

  // 3. Upsert Developers
  for (const dev of seed.developers) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO "Developer" ("id", "igdbId", "name", "slug", "avatarUrl")
            VALUES (?, ?, ?, ?, ?);`,
      args: [dev.id, dev.igdbId ?? null, dev.name, dev.slug, dev.avatarUrl ?? null],
    });
  }

  // 4. Upsert Publishers
  for (const pub of seed.publishers) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO "Publisher" ("id", "igdbId", "name", "slug")
            VALUES (?, ?, ?, ?);`,
      args: [pub.id, pub.igdbId ?? null, pub.name, pub.slug],
    });
  }

  // 5. Upsert Genres
  for (const gen of seed.genres) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO "Genre" ("id", "igdbId", "name", "slug")
            VALUES (?, ?, ?, ?);`,
      args: [gen.id, gen.igdbId ?? null, gen.name, gen.slug],
    });
  }

  // 6. Upsert Tags
  for (const tag of seed.tags) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO "Tag" ("id", "name", "slug")
            VALUES (?, ?, ?);`,
      args: [tag.id, tag.name, tag.slug],
    });
  }

  // 7. Upsert Platforms
  for (const plat of seed.platforms) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO "Platform" ("id", "igdbId", "name", "slug")
            VALUES (?, ?, ?, ?);`,
      args: [plat.id, plat.igdbId ?? null, plat.name, plat.slug],
    });
  }

  // 8. Upsert Games and Join Relations
  const now = Date.now();
  for (const game of seed.games) {
    await client.execute({
      sql: `INSERT INTO "Game" (
              "id", "igdbId", "title", "slug", "summary", "storyline",
              "releaseDate", "status", "coverUrl", "rating", "popularity",
              "likesCount", "isTrending", "createdAt", "updatedAt",
              "steamRating", "steamRatingDesc", "developerNames", "publisherNames",
              "genreNames", "platformNames"
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT("id") DO UPDATE SET
              "title" = excluded."title",
              "slug" = excluded."slug",
              "summary" = excluded."summary",
              "rating" = excluded."rating",
              "popularity" = excluded."popularity";`,
      args: [
        game.id,
        game.igdbId ?? null,
        game.title,
        game.slug,
        game.summary ?? null,
        game.storyline ?? null,
        game.releaseDate ?? null,
        game.status ?? "released",
        game.coverUrl ?? null,
        game.rating ?? null,
        game.popularity ?? 50.0,
        game.likesCount ?? 0,
        game.isTrending ? 1 : 0,
        now,
        now,
        game.steamRating ?? null,
        game.steamRatingDesc ?? null,
        game.developerNames ?? null,
        game.publisherNames ?? null,
        game.genreNames ?? null,
        game.platformNames ?? null,
      ],
    });

    // Developer relations
    if (game.developerIds) {
      for (const devId of game.developerIds) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO "_DeveloperToGame" ("A", "B") VALUES (?, ?);`,
          args: [devId, game.id],
        });
      }
    }

    // Publisher relations
    if (game.publisherIds) {
      for (const pubId of game.publisherIds) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO "_GameToPublisher" ("A", "B") VALUES (?, ?);`,
          args: [game.id, pubId],
        });
      }
    }

    // Genre relations
    if (game.genreIds) {
      for (const genId of game.genreIds) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO "_GameToGenre" ("A", "B") VALUES (?, ?);`,
          args: [game.id, genId],
        });
      }
    }

    // Tag relations
    if (game.tagIds) {
      for (const tagId of game.tagIds) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO "_GameToTag" ("A", "B") VALUES (?, ?);`,
          args: [game.id, tagId],
        });
      }
    }

    // Platform relations
    if (game.platformIds) {
      for (const platId of game.platformIds) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO "_GameToPlatform" ("A", "B") VALUES (?, ?);`,
          args: [game.id, platId],
        });
      }
    }

    // Price snapshot
    if (game.dealPrice !== undefined && game.regularPrice !== undefined) {
      const cut = Math.round(((game.regularPrice - game.dealPrice) / game.regularPrice) * 100);
      await client.execute({
        sql: `INSERT INTO "PriceSnapshot" (
                "id", "gameId", "storeName", "dealPrice", "retailPrice",
                "discountPercent", "dealUrl", "currency", "country", "provider", "updatedAt"
              ) VALUES (?, ?, 'Steam', ?, ?, ?, ?, 'USD', 'US', 'direct', ?)
              ON CONFLICT("id") DO UPDATE SET
                "dealPrice" = excluded."dealPrice",
                "retailPrice" = excluded."retailPrice",
                "discountPercent" = excluded."discountPercent",
                "updatedAt" = excluded."updatedAt";`,
        args: [
          `price_${game.id}`,
          game.id,
          game.dealPrice,
          game.regularPrice,
          cut,
          `https://store.steampowered.com/app/${game.igdbId}`,
          now,
        ],
      });
    }
  }

  console.log("=================================================");
  console.log(" Mock seed database initialized successfully!");
  console.log(`- 10 Horror games seeded`);
  console.log(`- 5 Developers, 2 Publishers, 5 Genres, 8 Tags, 3 Platforms`);
  console.log("- Location: ./local.db");
  console.log("Run 'npm run dev' to start the local development server.");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("[seed-mock] Failed to seed mock database:", err);
  process.exit(1);
});
