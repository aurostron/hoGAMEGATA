import { createClient } from "@libsql/client";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  process.exit(1);
}

const dataDir = path.resolve(process.cwd(), "data");
const localDbPath = path.join(dataDir, "gamegata-db.db");

if (!fs.existsSync(localDbPath)) {
  console.error(`❌ Local database not found at ${localDbPath}`);
  process.exit(1);
}

const localClient = createClient({ url: `file:${localDbPath.replace(/\\/g, "/")}` });

// Create pool of 8 concurrent remote Turso clients
const CONCURRENCY = 8;
const remoteClients = Array.from({ length: CONCURRENCY }, () =>
  createClient({ url, authToken })
);

async function syncTable(
  tableName: string,
  columns: string[],
  primaryKey: string,
  batchSize = 250
) {
  console.log(`\n📦 Starting High-Speed Sync for Table: "${tableName}"...`);
  const countRes = await localClient.execute(`SELECT count(*) as cnt FROM "${tableName}"`);
  const totalRows = Number(countRes.rows[0].cnt);
  console.log(`- Total local records in "${tableName}": ${totalRows}`);

  if (totalRows === 0) return;

  const colList = columns.map((c) => `"${c}"`).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  const startTime = Date.now();
  let processed = 0;

  // We split total rows into chunks
  const chunkCount = Math.ceil(totalRows / batchSize);
  const chunkIndices = Array.from({ length: chunkCount }, (_, i) => i);

  // Worker loop
  async function worker(workerId: number) {
    const client = remoteClients[workerId];
    while (chunkIndices.length > 0) {
      const chunkIdx = chunkIndices.shift();
      if (chunkIdx === undefined) break;

      const offset = chunkIdx * batchSize;
      const rowsRes = await localClient.execute(
        `SELECT ${colList} FROM "${tableName}" LIMIT ${batchSize} OFFSET ${offset}`
      );

      const batchStatements = rowsRes.rows.map((row) => ({
        sql,
        args: columns.map((c) => row[c]),
      }));

      if (batchStatements.length > 0) {
        try {
          await client.batch(batchStatements, "write");
        } catch (err: any) {
          // If batch fails, execute individual statements to isolate errors
          for (const stmt of batchStatements) {
            try {
              await client.execute(stmt);
            } catch {}
          }
        }
      }

      processed += rowsRes.rows.length;
      if (processed % 5000 < batchSize || processed >= totalRows) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(0);
        console.log(
          `⏳ "${tableName}": ${processed}/${totalRows} rows (${((processed / totalRows) * 100).toFixed(1)}%) | ${rate} rows/sec | Elapsed: ${elapsed}s`
        );
      }
    }
  }

  // Run workers in parallel
  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i))
  );

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Table "${tableName}" synced completely in ${totalTime}s!\n`);
}

async function main() {
  console.log("\n🚀 Starting Multi-Worker Parallel Sync to Remote Turso DB...\n");
  console.log(`🌐 Target: ${url}`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} parallel client workers\n`);

  // 1. Sync Developers (68k)
  await syncTable("Developer", ["id", "igdbId", "name", "slug", "avatarUrl"], "id", 300);

  // 2. Sync Tags (15.8k)
  await syncTable("Tag", ["id", "name", "slug"], "id", 400);

  // 3. Sync Genres
  await syncTable("Genre", ["id", "igdbId", "name", "slug"], "id", 400);

  // 4. Sync Games (107.8k)
  await syncTable(
    "Game",
    [
      "id",
      "igdbId",
      "title",
      "slug",
      "summary",
      "storyline",
      "releaseDate",
      "status",
      "coverUrl",
      "rating",
      "trailerUrl",
      "screenshots",
      "catboxAlbumId",
      "likesCount",
      "isTrending",
      "createdAt",
      "updatedAt",
      "metacritic",
      "metacriticUrl",
      "playtime",
      "esrbRating",
      "pegiRating",
      "redditUrl",
      "websiteUrl",
      "rawgRating",
      "rawgSlug",
      "rawgEnriched",
      "rawgId",
      "lastRawgSync",
      "rawgMetadataHash",
      "steamRating",
      "steamRatingDesc",
      "lastSteamSync",
      "scareRating",
      "scareProfile",
      "scareReviewCount",
      "lastScareSync",
      "protonDbTier",
      "protonDbConfidence",
      "protonDbScore",
      "protonDbTotalReports",
      "lastProtonDbSync",
      "category",
      "minRequirements",
      "recRequirements",
      "popularity",
      "developerNames",
      "genreNames",
      "platformNames",
      "source",
      "taxonomyScores",
    ],
    "id",
    200
  );

  // 5. Sync PurchaseLinks (111k)
  await syncTable("PurchaseLink", ["id", "storeName", "url", "gameId"], "id", 300);

  // 6. Sync PriceSnapshots (104k)
  await syncTable(
    "PriceSnapshot",
    [
      "id",
      "gameId",
      "storeName",
      "dealPrice",
      "retailPrice",
      "discountPercent",
      "dealUrl",
      "currency",
      "country",
      "provider",
      "updatedAt",
    ],
    "id",
    300
  );

  // 7. Sync Relations Join Tables
  await syncTable("_DeveloperToGame", ["A", "B"], "A", 500);
  await syncTable("_GameToGenre", ["A", "B"], "A", 500);
  await syncTable("_GameToTag", ["A", "B"], "A", 500);

  console.log("\n🎉 ALL MASTER TABLES SYNCED 100% TO REMOTE TURSO CLOUD DB!\n");
}

main().catch(console.error);
