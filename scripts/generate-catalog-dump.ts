import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { turso, initTursoForRequest } from "../src/lib/turso";
import {
  games as gamesTable,
  genres as genresTable,
  tags as tagsTable,
  gamesToGenres,
  gamesToTags,
  priceSnapshots as priceSnapshotsTable,
} from "../src/db/schema";
import { or, isNull, ne, sql, inArray } from "drizzle-orm";
import { isDlcOrExtra } from "../src/lib/dlcHelper";

initTursoForRequest(process.env);

interface CatalogRecord {
  i: string;           // id
  t: string;           // title
  s: string;           // slug
  c: string | null;    // coverUrl
  dn: string | null;   // developerNames
  pn: string | null;   // platformNames
  rd: number | null;   // releaseDate as unix epoch seconds
  rt: number | null;   // rating (0-100)
  sr: number | null;   // steamRating (0-10)
  mc: number | null;   // metacritic
  rr: number | null;   // rawgRating (0-5)
  cat: number | null;  // category
  pop: number | null;  // popularity
  tr: boolean;         // isTrending
  lk: number;          // likesCount
  gs: string[];        // genre slugs
  ts: string[];        // tag slugs
  dp: number | null;   // cheapest deal price
  st: string | null;   // status
}

async function generateCatalogDump() {
  const startTime = performance.now();
  console.log("==================================================");
  console.log("📦 GENERATING SINGLE-FILE GZIP CATALOG DUMP");
  console.log("==================================================\n");

  // 1. Query all non-hidden games
  console.log("1. Fetching all visible games from TursoDB...");
  const games = await turso
    .select({
      id: gamesTable.id,
      title: gamesTable.title,
      slug: gamesTable.slug,
      coverUrl: gamesTable.coverUrl,
      developerNames: gamesTable.developerNames,
      platformNames: gamesTable.platformNames,
      releaseDate: gamesTable.releaseDate,
      rating: gamesTable.rating,
      steamRating: gamesTable.steamRating,
      metacritic: gamesTable.metacritic,
      rawgRating: gamesTable.rawgRating,
      category: gamesTable.category,
      popularity: gamesTable.popularity,
      isTrending: gamesTable.isTrending,
      likesCount: gamesTable.likesCount,
      status: gamesTable.status,
    })
    .from(gamesTable)
    .where(or(isNull(gamesTable.status), ne(gamesTable.status, "hidden")));

  console.log(`   ✓ Retrieved ${games.length.toLocaleString()} visible games in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

  // 2. Fetch all genre mappings
  console.log("2. Fetching genre mappings...");
  const genreMap = new Map<string, string[]>();
  try {
    const genreRows = await turso
      .select({
        gameId: gamesToGenres.gameId,
        slug: genresTable.slug,
      })
      .from(gamesToGenres)
      .innerJoin(genresTable, sql`${gamesToGenres.genreId} = ${genresTable.id}`);

    for (const row of genreRows) {
      if (!row.gameId || !row.slug) continue;
      if (!genreMap.has(row.gameId)) genreMap.set(row.gameId, []);
      genreMap.get(row.gameId)!.push(row.slug);
    }
    console.log(`   ✓ Mapped ${genreRows.length.toLocaleString()} genre associations across ${genreMap.size.toLocaleString()} games`);
  } catch (err: any) {
    console.warn("   ⚠️ Warning: Failed to query genres, continuing without genres:", err.message);
  }

  // 3. Fetch all tag mappings
  console.log("3. Fetching tag mappings...");
  const tagMap = new Map<string, string[]>();
  try {
    const tagRows = await turso
      .select({
        gameId: gamesToTags.gameId,
        slug: tagsTable.slug,
      })
      .from(gamesToTags)
      .innerJoin(tagsTable, sql`${gamesToTags.tagId} = ${tagsTable.id}`);

    for (const row of tagRows) {
      if (!row.gameId || !row.slug) continue;
      if (!tagMap.has(row.gameId)) tagMap.set(row.gameId, []);
      tagMap.get(row.gameId)!.push(row.slug);
    }
    console.log(`   ✓ Mapped ${tagRows.length.toLocaleString()} tag associations across ${tagMap.size.toLocaleString()} games`);
  } catch (err: any) {
    console.warn("   ⚠️ Warning: Failed to query tags, continuing without tags:", err.message);
  }

  // 4. Fetch cheapest prices
  console.log("4. Fetching deal prices from PriceSnapshot...");
  const priceMap = new Map<string, number>();
  try {
    const priceRows = await turso
      .select({
        gameId: priceSnapshotsTable.gameId,
        minPrice: sql<number>`MIN(CASE WHEN ${priceSnapshotsTable.currency} = 'INR' THEN ${priceSnapshotsTable.dealPrice} / 83.5 ELSE ${priceSnapshotsTable.dealPrice} END)`,
      })
      .from(priceSnapshotsTable)
      .groupBy(priceSnapshotsTable.gameId);

    for (const row of priceRows) {
      if (row.gameId && row.minPrice != null) {
        priceMap.set(row.gameId, row.minPrice);
      }
    }
    console.log(`   ✓ Mapped deal prices for ${priceMap.size.toLocaleString()} games`);
  } catch (err: any) {
    console.warn("   ⚠️ Warning: Failed to query price snapshots:", err.message);
  }

  // 5. Construct compact records
  console.log("5. Assembling compact sanitized records...");
  const records: CatalogRecord[] = games.map((g) => {
    let rdSec: number | null = null;
    if (g.releaseDate != null) {
      const num = Number(g.releaseDate);
      if (!isNaN(num) && num > 0) {
        // Defensive check: normalize milliseconds to seconds if > 100 billion
        rdSec = num > 100000000000 ? Math.floor(num / 1000) : num;
      }
    }

    return {
      i: g.id,
      t: g.title,
      s: g.slug,
      c: g.coverUrl || null,
      dn: g.developerNames || null,
      pn: g.platformNames || null,
      rd: rdSec,
      rt: g.rating != null ? Math.round(g.rating) : null,
      sr: g.steamRating != null ? Math.round(g.steamRating * 10) / 10 : null,
      mc: g.metacritic || null,
      rr: g.rawgRating != null ? Math.round(g.rawgRating * 10) / 10 : null,
      cat: g.category != null ? g.category : (isDlcOrExtra(g.title) ? 1 : null),
      pop: g.popularity != null ? Math.round(g.popularity * 10) / 10 : null,
      tr: Boolean(g.isTrending),
      lk: g.likesCount || 0,
      gs: genreMap.get(g.id) || [],
      ts: tagMap.get(g.id) || [],
      dp: priceMap.get(g.id) ?? null,
      st: g.status || null,
    };
  });

  // 6. Serialize & Gzip Compress
  console.log("6. Serializing JSON and compressing with Gzip...");
  const rawJson = JSON.stringify(records);
  const rawBuffer = Buffer.from(rawJson, "utf-8");
  const rawBytes = rawBuffer.length;
  const rawMb = (rawBytes / (1024 * 1024)).toFixed(2);

  const gzipBuffer = zlib.gzipSync(rawBuffer, { level: 9 });
  const gzipBytes = gzipBuffer.length;
  const gzipMb = (gzipBytes / (1024 * 1024)).toFixed(2);

  console.log(`   ✓ Uncompressed size: ${rawMb} MB (${rawBytes.toLocaleString()} bytes)`);
  console.log(`   ✓ Gzip compressed size: ${gzipMb} MB (${gzipBytes.toLocaleString()} bytes) [${((gzipBytes / rawBytes) * 100).toFixed(1)}% of original]`);

  // 7. Write to local directories
  const now = new Date();
  const version = now.toISOString().slice(0, 10).replace(/-/g, ".") + "." + String(now.getUTCHours()).padStart(2, "0") + String(now.getUTCMinutes()).padStart(2, "0");

  const manifest = {
    version,
    totalGames: records.length,
    compressedBytes: gzipBytes,
    uncompressedBytes: rawBytes,
    compressedMb: parseFloat(gzipMb),
    uncompressedMb: parseFloat(rawMb),
    updatedAt: now.toISOString(),
  };

  const outputDirs = [
    path.resolve(process.cwd(), "public", "catalog"),
    path.resolve(process.cwd(), "..", "project-hgg.github.io", "docs", "public"),
  ];

  for (const dir of outputDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Write manifest
      fs.writeFileSync(path.join(dir, "catalog-manifest.json"), JSON.stringify(manifest, null, 2));
      // Write gzipped dump
      fs.writeFileSync(path.join(dir, "catalog-dump.json.gz"), gzipBuffer);
      console.log(`   ✓ Saved files to: ${dir}`);
    } catch (e: any) {
      console.warn(`   ⚠️ Warning: Could not save to ${dir}:`, e.message);
    }
  }

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log("\n==================================================");
  console.log(`🎉 CATALOG DUMP READY in ${totalTime}s`);
  console.log(`   Version: ${version}`);
  console.log(`   Total Games: ${records.length.toLocaleString()}`);
  console.log(`   Gzipped Size: ${gzipMb} MB`);
  console.log("==================================================\n");
}

generateCatalogDump().catch((err) => {
  console.error("Fatal error generating catalog dump:", err);
  process.exit(1);
});
