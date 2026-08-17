import { createClient } from "@libsql/client";
import * as path from "path";
import * as fs from "fs";

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "gamegata-db.db");
const exportCsvPath = path.join(dataDir, "gamegata_catalog_detailed.csv");
const exportDbPath = path.join(dataDir, "gamegata_catalog_detailed.db");

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found at ${dbPath}`);
  process.exit(1);
}

const client = createClient({ url: `file:${dbPath.replace(/\\/g, "/")}` });

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  console.log("\n📊 Generating Detailed Catalog Export (CSV & SQLite DB)...\n");

  // 1. Load Purchase Links Map (gameId -> list of URLs)
  console.log("🔗 Loading purchase links and store URLs...");
  const purchaseLinksRes = await client.execute('SELECT gameId, storeName, url FROM "PurchaseLink"');
  const linksMap = new Map<string, Array<{ store: string; url: string }>>();
  for (const row of purchaseLinksRes.rows) {
    const gId = String(row.gameId);
    if (!linksMap.has(gId)) linksMap.set(gId, []);
    linksMap.get(gId)!.push({ store: String(row.storeName), url: String(row.url) });
  }
  console.log(`- Loaded ${purchaseLinksRes.rows.length} store links.`);

  // 2. Load Price Snapshots Map (gameId -> price info)
  console.log("💰 Loading price snapshots...");
  const priceRes = await client.execute('SELECT gameId, storeName, retailPrice, dealPrice, currency FROM "PriceSnapshot"');
  const priceMap = new Map<string, string>();
  for (const row of priceRes.rows) {
    const gId = String(row.gameId);
    const retail = Number(row.retailPrice);
    const deal = Number(row.dealPrice);
    const curr = String(row.currency || "USD");
    const priceStr = retail === 0 && deal === 0 ? "Free" : `${deal} ${curr}`;
    priceMap.set(gId, priceStr);
  }
  console.log(`- Loaded ${priceRes.rows.length} price snapshots.`);

  // 3. Load Game-to-Tag mappings with Tag names
  console.log("🏷️ Loading tags and AI classifications...");
  const tagsRes = await client.execute(`
    SELECT "_GameToTag"."A" as gameId, "Tag"."name" as tagName, "Tag"."slug" as tagSlug
    FROM "_GameToTag"
    INNER JOIN "Tag" ON "_GameToTag"."B" = "Tag"."id"
  `);
  const tagsMap = new Map<string, string[]>();
  for (const row of tagsRes.rows) {
    const gId = String(row.gameId);
    if (!tagsMap.has(gId)) tagsMap.set(gId, []);
    tagsMap.get(gId)!.push(String(row.tagName));
  }
  console.log(`- Loaded ${tagsRes.rows.length} tag associations.`);

  // 4. Initialize CSV Stream
  console.log(`\n📝 Writing Detailed CSV to: ${exportCsvPath}`);
  const csvHeaders = [
    "game_id",
    "title",
    "slug",
    "source",
    "status",
    "rating_100",
    "stars_5scale",
    "price",
    "developer_names",
    "developer_page_urls",
    "genre_names",
    "tags",
    "ai_tag_classification",
    "cover_url",
    "trailer_url",
    "has_screenshots",
    "summary",
    "store_purchase_urls",
    "gamegata_url",
    "created_at",
    "updated_at"
  ];

  const writeStream = fs.createWriteStream(exportCsvPath, { encoding: "utf-8" });
  writeStream.write(csvHeaders.join(",") + "\n");

  // 5. Initialize Detailed SQLite Export DB
  if (fs.existsSync(exportDbPath)) fs.unlinkSync(exportDbPath);
  const exportDb = createClient({ url: `file:${exportDbPath.replace(/\\/g, "/")}` });

  await exportDb.execute(`
    CREATE TABLE catalog_games (
      game_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      source TEXT,
      status TEXT,
      rating_100 REAL,
      stars_5scale REAL,
      price TEXT,
      developer_names TEXT,
      developer_page_urls TEXT,
      genre_names TEXT,
      tags TEXT,
      ai_tag_classification TEXT,
      cover_url TEXT,
      trailer_url TEXT,
      has_screenshots INTEGER,
      summary TEXT,
      store_purchase_urls TEXT,
      gamegata_url TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 6. Iterate all games in chunks of 5000
  const totalGamesRes = await client.execute('SELECT count(*) as cnt FROM "Game"');
  const totalGames = Number(totalGamesRes.rows[0].cnt);
  console.log(`🚀 Exporting ${totalGames} total catalog records...`);

  const CHUNK_SIZE = 5000;
  let offset = 0;
  let exportedCount = 0;

  while (offset < totalGames) {
    const gamesChunk = await client.execute(`
      SELECT id, title, slug, source, status, rating, coverUrl, trailerUrl, screenshots, summary, developerNames, genreNames, createdAt, updatedAt
      FROM "Game"
      LIMIT ${CHUNK_SIZE} OFFSET ${offset}
    `);

    const dbBatch: Array<{ sql: string; args: any[] }> = [];

    for (const g of gamesChunk.rows) {
      const gId = String(g.id);
      const title = String(g.title || "");
      const slug = String(g.slug || "");
      const source = String(g.source || "igdb");
      const status = String(g.status || "released");
      const rating = g.rating !== null ? Number(g.rating) : null;
      const stars5 = rating !== null ? Number((rating / 20).toFixed(1)) : null;
      const price = priceMap.get(gId) || "N/A";
      const devNames = String(g.developerNames || "");
      
      const devPageUrls = devNames
        ? devNames
            .split(",")
            .map((d) => `/developer/${d.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`)
            .join("; ")
        : "";

      const genreNames = String(g.genreNames || "Horror, Indie");
      const tagsList = tagsMap.get(gId) || [];
      const tagsStr = tagsList.join("; ");

      // AI Classification
      let aiTag = "Standard (Human)";
      if (tagsList.includes("No AI")) aiTag = "Verified No AI";
      if (tagsList.includes("AI-Assisted")) aiTag = "AI-Assisted";
      if (tagsList.includes("AI Text")) aiTag = "AI-Generated Text";

      const coverUrl = g.coverUrl ? String(g.coverUrl) : "";
      const trailerUrl = g.trailerUrl ? String(g.trailerUrl) : "";
      const hasScreenshots = g.screenshots && String(g.screenshots).length > 5 ? 1 : 0;
      const summary = g.summary ? String(g.summary).replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim().slice(0, 500) : "";
      
      const storeLinks = (linksMap.get(gId) || []).map((l) => `${l.store}: ${l.url}`).join("; ");
      const gamegataUrl = `https://gamegata.xyz/game/${slug}`;
      const createdAt = g.createdAt ? new Date(Number(g.createdAt)).toISOString() : "";
      const updatedAt = g.updatedAt ? new Date(Number(g.updatedAt)).toISOString() : "";

      // CSV Row
      const row = [
        escapeCsv(gId),
        escapeCsv(title),
        escapeCsv(slug),
        escapeCsv(source),
        escapeCsv(status),
        escapeCsv(rating),
        escapeCsv(stars5),
        escapeCsv(price),
        escapeCsv(devNames),
        escapeCsv(devPageUrls),
        escapeCsv(genreNames),
        escapeCsv(tagsStr),
        escapeCsv(aiTag),
        escapeCsv(coverUrl),
        escapeCsv(trailerUrl),
        escapeCsv(hasScreenshots),
        escapeCsv(summary),
        escapeCsv(storeLinks),
        escapeCsv(gamegataUrl),
        escapeCsv(createdAt),
        escapeCsv(updatedAt),
      ];
      writeStream.write(row.join(",") + "\n");

      // SQLite Row
      dbBatch.push({
        sql: `INSERT INTO catalog_games VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          gId,
          title,
          slug,
          source,
          status,
          rating,
          stars5,
          price,
          devNames,
          devPageUrls,
          genreNames,
          tagsStr,
          aiTag,
          coverUrl,
          trailerUrl,
          hasScreenshots,
          summary,
          storeLinks,
          gamegataUrl,
          createdAt,
          updatedAt,
        ],
      });

      exportedCount++;
    }

    if (dbBatch.length > 0) {
      await exportDb.batch(dbBatch, "write");
    }

    offset += CHUNK_SIZE;
    console.log(`⏳ Exported ${exportedCount}/${totalGames} records (${((exportedCount / totalGames) * 100).toFixed(1)}%)...`);
  }

  writeStream.end();

  // Create SQLite indexes on the export DB for instant search
  console.log("⚡ Building SQLite indexes on export DB...");
  await exportDb.execute('CREATE INDEX idx_catalog_title ON catalog_games(title);');
  await exportDb.execute('CREATE INDEX idx_catalog_source ON catalog_games(source);');
  await exportDb.execute('CREATE INDEX idx_catalog_rating ON catalog_games(rating_100);');
  await exportDb.execute('CREATE INDEX idx_catalog_ai ON catalog_games(ai_tag_classification);');

  const csvStats = fs.statSync(exportCsvPath);
  const dbStats = fs.statSync(exportDbPath);

  console.log("\n🎉 Catalog Export Completed Successfully!");
  console.log(`📁 CSV File: ${exportCsvPath} (${(csvStats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`📁 SQLite DB File: ${exportDbPath} (${(dbStats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`🎮 Total Records: ${exportedCount}`);
}

main().catch(console.error);
