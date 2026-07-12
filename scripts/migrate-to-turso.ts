import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!connectionString) {
  console.error("❌ DATABASE_URL is missing in .env.");
  process.exit(1);
}

if (!tursoUrl) {
  console.error("❌ TURSO_DATABASE_URL is missing in .env.");
  process.exit(1);
}

async function run() {
  console.log("🚀 Starting database migration from Supabase (PostgreSQL) to Turso (libSQL)...");

  // 1. Initialize Supabase Prisma
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // 2. Initialize Turso Drizzle
  const libsqlClient = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });
  const turso = drizzle(libsqlClient, { schema });

  // Helper chunking function to insert in chunks
  async function insertInChunks<T>(
    table: any,
    records: T[],
    chunkSize = 100
  ) {
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await turso.insert(table).values(chunk as any).onConflictDoNothing();
    }
  }

  try {
    // --- 2.5 Clear Existing Turso Data ---
    console.log("🧹 Cleaning up existing data on Turso to prepare for fresh sync...");
    await turso.delete(schema.gameRecommendations);
    await turso.delete(schema.priceSnapshots);
    await turso.delete(schema.purchaseLinks);
    await turso.delete(schema.gamesToPlatforms);
    await turso.delete(schema.gamesToPublishers);
    await turso.delete(schema.gamesToDevelopers);
    await turso.delete(schema.gamesToTags);
    await turso.delete(schema.gamesToGenres);
    await turso.delete(schema.games);
    await turso.delete(schema.publishers);
    await turso.delete(schema.developers);
    await turso.delete(schema.tags);
    await turso.delete(schema.genres);
    await turso.delete(schema.platforms);
    console.log("🧼 Turso cleaned successfully. Starting fresh sync from Supabase...");

    // --- 3. Platforms ---
    console.log("🔌 Migrating Platforms...");
    const platforms = await prisma.platform.findMany();
    console.log(`Found ${platforms.length} platforms.`);
    const mappedPlatforms = platforms.map(p => ({
      id: p.id,
      igdbId: p.igdbId,
      name: p.name,
      slug: p.slug,
    }));
    await insertInChunks(schema.platforms, mappedPlatforms);
    console.log("✅ Platforms migrated.");

    // --- 4. Genres ---
    console.log("🔌 Migrating Genres...");
    const genres = await prisma.genre.findMany();
    console.log(`Found ${genres.length} genres.`);
    const mappedGenres = genres.map(g => ({
      id: g.id,
      igdbId: g.igdbId,
      name: g.name,
      slug: g.slug,
    }));
    await insertInChunks(schema.genres, mappedGenres);
    console.log("✅ Genres migrated.");

    // --- 5. Tags ---
    console.log("🔌 Migrating Tags...");
    const tags = await prisma.tag.findMany();
    console.log(`Found ${tags.length} tags.`);
    const mappedTags = tags.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    }));
    await insertInChunks(schema.tags, mappedTags, 300);
    console.log("✅ Tags migrated.");

    // --- 6. Developers ---
    console.log("🔌 Migrating Developers...");
    const developers = await prisma.developer.findMany();
    console.log(`Found ${developers.length} developers.`);
    const mappedDevelopers = developers.map(d => ({
      id: d.id,
      igdbId: d.igdbId,
      name: d.name,
      slug: d.slug,
      avatarUrl: d.avatarUrl,
    }));
    await insertInChunks(schema.developers, mappedDevelopers, 200);
    console.log("✅ Developers migrated.");

    // --- 7. Publishers ---
    console.log("🔌 Migrating Publishers...");
    const publishers = await prisma.publisher.findMany();
    console.log(`Found ${publishers.length} publishers.`);
    const mappedPublishers = publishers.map(p => ({
      id: p.id,
      igdbId: p.igdbId,
      name: p.name,
      slug: p.slug,
    }));
    await insertInChunks(schema.publishers, mappedPublishers, 200);
    console.log("✅ Publishers migrated.");

    // --- 8. Games & Join Relations ---
    console.log("🔌 Migrating Games (this may take a while)...");
    const totalGames = await prisma.game.count();
    console.log(`Total games to migrate: ${totalGames}`);

    const batchSize = 100;
    let offset = 0;
    let gamesMigrated = 0;

    while (offset < totalGames) {
      console.log(`Fetching games ${offset} to ${offset + batchSize}...`);
      const gamesBatch = await prisma.game.findMany({
        skip: offset,
        take: batchSize,
        include: {
          genres: { select: { id: true } },
          tags: { select: { id: true } },
          developers: { select: { id: true } },
          publishers: { select: { id: true } },
          platforms: { select: { id: true } },
        }
      });

      if (gamesBatch.length === 0) break;

      const gamesToInsert = [];
      const gameToGenreJoin = [];
      const gameToTagJoin = [];
      const developerToGameJoin = [];
      const gameToPublisherJoin = [];
      const gameToPlatformJoin = [];

      for (const g of gamesBatch) {
        gamesToInsert.push({
          id: g.id,
          igdbId: g.igdbId,
          title: g.title,
          slug: g.slug,
          summary: g.summary,
          storyline: g.storyline,
          releaseDate: g.releaseDate,
          status: g.status,
          coverUrl: g.coverUrl,
          rating: g.rating,
          trailerUrl: g.trailerUrl,
          screenshots: g.screenshots ? JSON.stringify(g.screenshots) : null,
          isTrending: g.isTrending,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
          metacritic: g.metacritic,
          metacriticUrl: g.metacriticUrl,
          playtime: g.playtime,
          esrbRating: g.esrbRating,
          pegiRating: g.pegiRating,
          redditUrl: g.redditUrl,
          websiteUrl: g.websiteUrl,
          rawgRating: g.rawgRating,
          rawgSlug: g.rawgSlug,
          rawgEnriched: g.rawgEnriched,
          rawgId: g.rawgId,
          lastRawgSync: g.lastRawgSync,
          rawgMetadataHash: g.rawgMetadataHash,
          steamRating: g.steamRating,
          steamRatingDesc: g.steamRatingDesc,
          lastSteamSync: g.lastSteamSync,
          scareRating: g.scareRating,
          scareProfile: g.scareProfile ? JSON.stringify(g.scareProfile) : null,
          scareReviewCount: g.scareReviewCount,
          lastScareSync: g.lastScareSync,
          protonDbTier: g.protonDbTier,
          protonDbConfidence: g.protonDbConfidence,
          protonDbScore: g.protonDbScore,
          protonDbTotalReports: g.protonDbTotalReports,
          lastProtonDbSync: g.lastProtonDbSync,
          category: g.category,
          minRequirements: g.minRequirements,
          recRequirements: g.recRequirements,
          popularity: g.popularity,
          developerNames: g.developerNames,
          genreNames: g.genreNames,
          platformNames: g.platformNames,
          source: g.source,
          taxonomyScores: g.taxonomyScores ? JSON.stringify(g.taxonomyScores) : null,
        });

        // Collect relationships
        for (const gen of g.genres) {
          gameToGenreJoin.push({ gameId: g.id, genreId: gen.id });
        }
        for (const t of g.tags) {
          gameToTagJoin.push({ gameId: g.id, tagId: t.id });
        }
        for (const dev of g.developers) {
          developerToGameJoin.push({ developerId: dev.id, gameId: g.id });
        }
        for (const pub of g.publishers) {
          gameToPublisherJoin.push({ gameId: g.id, publisherId: pub.id });
        }
        for (const plat of g.platforms) {
          gameToPlatformJoin.push({ gameId: g.id, platformId: plat.id });
        }
      }

      // Bulk write games
      await turso.insert(schema.games).values(gamesToInsert).onConflictDoNothing();

      // Bulk write joins in safe smaller chunks
      if (gameToGenreJoin.length > 0) {
        await insertInChunks(schema.gamesToGenres, gameToGenreJoin, 200);
      }
      if (gameToTagJoin.length > 0) {
        await insertInChunks(schema.gamesToTags, gameToTagJoin, 200);
      }
      if (developerToGameJoin.length > 0) {
        await insertInChunks(schema.gamesToDevelopers, developerToGameJoin, 200);
      }
      if (gameToPublisherJoin.length > 0) {
        await insertInChunks(schema.gamesToPublishers, gameToPublisherJoin, 200);
      }
      if (gameToPlatformJoin.length > 0) {
        await insertInChunks(schema.gamesToPlatforms, gameToPlatformJoin, 200);
      }

      gamesMigrated += gamesBatch.length;
      console.log(`Progress: ${gamesMigrated}/${totalGames} games migrated.`);
      offset += batchSize;
    }
    console.log("✅ Games and relationships migrated successfully.");

    // --- 9. Purchase Links ---
    console.log("🔌 Migrating Purchase Links...");
    const links = await prisma.purchaseLink.findMany();
    console.log(`Found ${links.length} purchase links.`);
    const mappedLinks = links.map(l => ({
      id: l.id,
      storeName: l.storeName,
      url: l.url,
      gameId: l.gameId,
    }));
    await insertInChunks(schema.purchaseLinks, mappedLinks, 200);
    console.log("✅ Purchase Links migrated.");

    // --- 10. Price Snapshots ---
    console.log("🔌 Migrating Price Snapshots...");
    const snapshots = await prisma.priceSnapshot.findMany();
    console.log(`Found ${snapshots.length} price snapshots.`);
    const mappedSnapshots = snapshots.map(s => ({
      id: s.id,
      gameId: s.gameId,
      storeName: s.storeName,
      dealPrice: s.dealPrice,
      retailPrice: s.retailPrice,
      discountPercent: s.discountPercent,
      dealUrl: s.dealUrl,
      currency: s.currency,
      country: s.country,
      updatedAt: s.updatedAt,
    }));
    await insertInChunks(schema.priceSnapshots, mappedSnapshots, 200);
    console.log("✅ Price Snapshots migrated.");

    // --- 11. Recommendations ---
    console.log("🔌 Migrating Game Recommendations...");
    const recs = await prisma.gameRecommendation.findMany();
    console.log(`Found ${recs.length} recommendations.`);
    const mappedRecs = recs.map(r => ({
      gameId: r.gameId,
      recommendedGameId: r.recommendedGameId,
      distance: r.distance,
    }));
    await insertInChunks(schema.gameRecommendations, mappedRecs, 200);
    console.log("✅ Game Recommendations migrated.");

    console.log("\n🎉 Database migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
    libsqlClient.close();
  }
}

run().catch(console.error);
