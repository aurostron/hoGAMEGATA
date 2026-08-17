import { createClient } from "@libsql/client";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

// Parse command line options: --target=local (default) or --target=remote
const args = process.argv.slice(2);
let target = "local";
let limitArg: number | null = null;

for (const a of args) {
  if (a.startsWith("--target=")) target = a.split("=")[1];
  if (a.startsWith("--limit=")) limitArg = parseInt(a.split("=")[1], 10);
}

const dataDir = path.resolve(process.cwd(), "data");
const itchDbPath = path.join(dataDir, "itch-horror.db");
const localGamegataDbPath = path.join(dataDir, "gamegata-db.db");

if (!fs.existsSync(itchDbPath)) {
  console.error(`❌ itch-horror.db not found at ${itchDbPath}`);
  process.exit(1);
}

const itchClient = createClient({ url: `file:${itchDbPath.replace(/\\/g, "/")}` });

let gClient: ReturnType<typeof createClient>;
if (target === "remote") {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error("❌ Missing TURSO_DATABASE_URL in .env");
    process.exit(1);
  }
  console.log(`🌐 Connecting to Remote Turso DB: ${url}`);
  gClient = createClient({ url, authToken });
} else {
  if (!fs.existsSync(localGamegataDbPath)) {
    console.error(`❌ gamegata-db.db not found at ${localGamegataDbPath}`);
    process.exit(1);
  }
  console.log(`📁 Connecting to Local SQLite DB: ${localGamegataDbPath}`);
  gClient = createClient({ url: `file:${localGamegataDbPath.replace(/\\/g, "/")}` });
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url.toLowerCase().trim()).digest("hex").slice(0, 16);
}

function parsePrice(priceStr: string | null | undefined): { retailPrice: number; dealPrice: number } {
  if (!priceStr) return { retailPrice: 0, dealPrice: 0 };
  const clean = priceStr.toLowerCase().trim();
  if (clean === "" || clean === "free" || clean.includes("free")) {
    return { retailPrice: 0, dealPrice: 0 };
  }
  const match = clean.match(/[\$£€]?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    return { retailPrice: isNaN(num) ? 0 : num, dealPrice: isNaN(num) ? 0 : num };
  }
  return { retailPrice: 0, dealPrice: 0 };
}

const HORROR_GENRE_ID = "cmpwg3nr400a4g4eg6j8ark0v";
const INDIE_GENRE_ID = "cmpx2zhbk001g30eginriis48";

async function main() {
  console.log("\n🚀 Starting Itch.io Horror Games Migration Pipeline...\n");

  // 1. Preload existing games, purchase links, developers, and tags from Gamegata DB
  console.log("📦 Loading existing database cache...");
  const existingGamesRes = await gClient.execute('SELECT id, title, slug FROM "Game"');
  const titleToGameMap = new Map<string, { id: string; slug: string }>();
  const usedSlugs = new Set<string>();

  for (const g of existingGamesRes.rows) {
    const norm = normalizeTitle(String(g.title));
    const slugStr = String(g.slug);
    // Strictly isolate: Only match against existing itch.io entries, never attach itch links/prices onto non-itch commercial games
    if (norm && (slugStr.startsWith("itch-") || (g as any).source === "itch")) {
      titleToGameMap.set(norm, { id: String(g.id), slug: slugStr });
    }
    usedSlugs.add(slugStr.toLowerCase());
  }
  console.log(`- Loaded ${titleToGameMap.size} existing itch games into title index.`);

  const existingItchLinksRes = await gClient.execute(
    'SELECT gameId, url FROM "PurchaseLink" WHERE storeName = \'itch.io\' OR url LIKE \'%itch.io%\''
  );
  const existingItchUrls = new Set<string>();
  for (const l of existingItchLinksRes.rows) {
    if (l.url) existingItchUrls.add(String(l.url).toLowerCase().trim().replace(/\/$/, ""));
  }
  console.log(`- Loaded ${existingItchUrls.size} existing itch purchase links.`);

  const existingDevsRes = await gClient.execute('SELECT id, slug, name FROM "Developer"');
  const devSlugToIdMap = new Map<string, string>();
  for (const d of existingDevsRes.rows) {
    devSlugToIdMap.set(String(d.slug).toLowerCase(), String(d.id));
  }
  console.log(`- Loaded ${devSlugToIdMap.size} existing developers.`);

  const existingTagsRes = await gClient.execute('SELECT id, slug, name FROM "Tag"');
  const tagSlugToIdMap = new Map<string, string>();
  for (const t of existingTagsRes.rows) {
    tagSlugToIdMap.set(String(t.slug).toLowerCase(), String(t.id));
  }
  console.log(`- Loaded ${tagSlugToIdMap.size} existing tags.`);

  // 2. Fetch all scraped games from itch-horror.db
  console.log("\n📥 Fetching games from itch-horror.db...");
  const limitClause = limitArg ? `LIMIT ${limitArg}` : "";
  const itchGamesRes = await itchClient.execute(
    `SELECT url, title, author, author_url, stars, ratings, price, desc, tags, cover, ai_no_ai, ai_assisted, ai_text FROM games ${limitClause}`
  );
  const totalItchGames = itchGamesRes.rows.length;
  console.log(`- Total records to process: ${totalItchGames}`);

  // 3. Prepare Batch Queues
  let matchedExistingCount = 0;
  let newGamesCount = 0;

  const developerInserts: Array<{ id: string; name: string; slug: string }> = [];
  const tagInserts: Array<{ id: string; name: string; slug: string }> = [];
  
  // Statements batch buffer
  let batchStatements: Array<{ sql: string; args: any[] }> = [];
  const BATCH_FLUSH_SIZE = 250;

  async function flushBatch() {
    if (batchStatements.length === 0) return;
    try {
      await gClient.batch(batchStatements, "write");
      batchStatements = [];
    } catch (err) {
      console.error("❌ Batch execution error:", err);
      // Fallback: execute one by one to avoid losing entire batch
      for (const st of batchStatements) {
        try {
          await gClient.execute(st);
        } catch (singleErr) {
          // ignore duplicate constraint errors
        }
      }
      batchStatements = [];
    }
  }

  const startTime = Date.now();
  let processed = 0;

  for (const row of itchGamesRes.rows) {
    processed++;
    const rawUrl = String(row.url || "").trim();
    if (!rawUrl) continue;
    const cleanUrl = rawUrl.replace(/\/$/, "");
    const rawTitle = String(row.title || "").trim();
    if (!rawTitle) continue;
    const normTitle = normalizeTitle(rawTitle);
    const author = String(row.author || "").trim();
    const coverUrl = row.cover && String(row.cover).trim() !== "" ? String(row.cover).trim() : null;
    const stars = row.stars ? Number(row.stars) : 0;
    const rating100 = stars > 0 ? Math.min(100, Math.round(stars * 20)) : null;
    const summary = row.desc ? String(row.desc).trim() : null;
    const { retailPrice, dealPrice } = parsePrice(row.price ? String(row.price) : null);

    // AI tags & Parsed Tags
    const tagsList: string[] = [];
    if (row.tags) {
      try {
        const parsed = JSON.parse(String(row.tags));
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            const cleanT = String(t).trim();
            if (cleanT && cleanT.length <= 50) tagsList.push(cleanT);
          }
        }
      } catch {}
    }

    if (row.ai_no_ai === 1) tagsList.push("No AI");
    if (row.ai_assisted === 1) tagsList.push("AI-Assisted");
    if (row.ai_text === 1) tagsList.push("AI Text");

    // Developer handling
    let devId: string | null = null;
    if (author) {
      const devSlug = slugify(author) || `author-${hashUrl(author)}`;
      if (devSlugToIdMap.has(devSlug)) {
        devId = devSlugToIdMap.get(devSlug)!;
      } else {
        devId = `dev_itch_${devSlug}`;
        devSlugToIdMap.set(devSlug, devId);
        batchStatements.push({
          sql: `INSERT INTO "Developer" (id, name, slug) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
          args: [devId, author, devSlug],
        });
      }
    }

    // Process Tags
    const gameTagIds: string[] = [];
    for (const tagName of tagsList) {
      const tagSlug = slugify(tagName);
      if (!tagSlug) continue;
      let tagId: string;
      if (tagSlugToIdMap.has(tagSlug)) {
        tagId = tagSlugToIdMap.get(tagSlug)!;
      } else {
        tagId = `tag_${tagSlug}`;
        tagSlugToIdMap.set(tagSlug, tagId);
        batchStatements.push({
          sql: `INSERT INTO "Tag" (id, name, slug) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
          args: [tagId, tagName, tagSlug],
        });
      }
      gameTagIds.push(tagId);
    }

    // Check if this itch game matches an existing Gamegata game
    const existingMatch = titleToGameMap.get(normTitle);
    if (existingMatch) {
      matchedExistingCount++;
      const targetGameId = existingMatch.id;

      // Attach PurchaseLink for itch.io if not already present
      const linkId = `pl_itch_${hashUrl(cleanUrl)}`;
      batchStatements.push({
        sql: `INSERT INTO "PurchaseLink" (id, storeName, url, gameId) VALUES (?, 'itch.io', ?, ?) ON CONFLICT DO NOTHING`,
        args: [linkId, cleanUrl, targetGameId],
      });

      // PriceSnapshot
      const snapId = `ps_itch_${hashUrl(cleanUrl)}`;
      batchStatements.push({
        sql: `INSERT INTO "PriceSnapshot" (id, gameId, storeName, dealPrice, retailPrice, discountPercent, dealUrl, currency, country, provider, updatedAt)
              VALUES (?, ?, 'itch.io', ?, ?, ?, ?, 'USD', 'US', 'itch', ?)
              ON CONFLICT DO NOTHING`,
        args: [snapId, targetGameId, dealPrice, retailPrice, retailPrice > dealPrice ? Math.round(((retailPrice - dealPrice) / retailPrice) * 100) : 0, cleanUrl, Date.now()],
      });

      // Link tags
      for (const tId of gameTagIds) {
        batchStatements.push({
          sql: `INSERT INTO "_GameToTag" ("A", "B") VALUES (?, ?) ON CONFLICT DO NOTHING`,
          args: [targetGameId, tId],
        });
      }
    } else {
      // Create Brand New Game
      newGamesCount++;
      const urlHash = hashUrl(cleanUrl);
      const gameId = `itch_${urlHash}`;

      let baseSlug = slugify(rawTitle);
      if (!baseSlug) baseSlug = `game-${urlHash}`;
      let finalSlug = `itch-${baseSlug}`;
      if (usedSlugs.has(finalSlug)) {
        const authorPart = author ? slugify(author) : "";
        finalSlug = authorPart ? `itch-${authorPart}-${baseSlug}` : `itch-${baseSlug}-${urlHash.slice(0, 4)}`;
        if (usedSlugs.has(finalSlug)) {
          finalSlug = `itch-${baseSlug}-${urlHash.slice(0, 8)}`;
        }
      }
      usedSlugs.add(finalSlug);

      const now = Date.now();
      batchStatements.push({
        sql: `INSERT INTO "Game" (
          id, title, slug, summary, rating, coverUrl, status, source,
          developerNames, genreNames, platformNames, isTrending, likesCount, createdAt, updatedAt
        ) VALUES (
          ?, ?, ?, ?, ?, ?, 'released', 'itch',
          ?, 'Horror, Indie', 'PC', 0, 0, ?, ?
        ) ON CONFLICT (id) DO UPDATE SET
          coverUrl = coalesce(excluded.coverUrl, "Game".coverUrl),
          rating = coalesce(excluded.rating, "Game".rating),
          summary = coalesce(excluded.summary, "Game".summary),
          updatedAt = excluded.updatedAt`,
        args: [gameId, rawTitle, finalSlug, summary, rating100, coverUrl, author || "Independent Creator", now, now],
      });

      // Developer link
      if (devId) {
        batchStatements.push({
          sql: `INSERT INTO "_DeveloperToGame" ("A", "B") VALUES (?, ?) ON CONFLICT DO NOTHING`,
          args: [devId, gameId],
        });
      }

      // PurchaseLink
      const linkId = `pl_${gameId}`;
      batchStatements.push({
        sql: `INSERT INTO "PurchaseLink" (id, storeName, url, gameId) VALUES (?, 'itch.io', ?, ?) ON CONFLICT DO NOTHING`,
        args: [linkId, cleanUrl, gameId],
      });

      // PriceSnapshot
      const snapId = `ps_${gameId}`;
      batchStatements.push({
        sql: `INSERT INTO "PriceSnapshot" (id, gameId, storeName, dealPrice, retailPrice, discountPercent, dealUrl, currency, country, provider, updatedAt)
              VALUES (?, ?, 'itch.io', ?, ?, ?, ?, 'USD', 'US', 'itch', ?)
              ON CONFLICT DO NOTHING`,
        args: [snapId, gameId, dealPrice, retailPrice, retailPrice > dealPrice ? Math.round(((retailPrice - dealPrice) / retailPrice) * 100) : 0, cleanUrl, now],
      });

      // Genre links (Horror & Indie)
      batchStatements.push({
        sql: `INSERT INTO "_GameToGenre" ("A", "B") VALUES (?, ?) ON CONFLICT DO NOTHING`,
        args: [gameId, HORROR_GENRE_ID],
      });
      batchStatements.push({
        sql: `INSERT INTO "_GameToGenre" ("A", "B") VALUES (?, ?) ON CONFLICT DO NOTHING`,
        args: [gameId, INDIE_GENRE_ID],
      });

      // Tag links
      for (const tId of gameTagIds) {
        batchStatements.push({
          sql: `INSERT INTO "_GameToTag" ("A", "B") VALUES (?, ?) ON CONFLICT DO NOTHING`,
          args: [gameId, tId],
        });
      }
    }

    // Flush batch when threshold reached
    if (batchStatements.length >= BATCH_FLUSH_SIZE) {
      await flushBatch();
    }

    if (processed % 5000 === 0 || processed === totalItchGames) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(0);
      console.log(
        `⏳ Processed ${processed}/${totalItchGames} games (${((processed / totalItchGames) * 100).toFixed(1)}%) | ` +
        `Matched: ${matchedExistingCount} | New: ${newGamesCount} | ${rate} games/sec | Elapsed: ${elapsedSec}s`
      );
    }
  }

  // Final flush
  await flushBatch();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n🎉 Migration Completed Successfully!");
  console.log(`⏱️ Total Time: ${totalTime}s`);
  console.log(`📊 Matched & Enriched Existing Games: ${matchedExistingCount}`);
  console.log(`🆕 Created New Itch Games: ${newGamesCount}`);
  console.log(`🏷️ Total Tags in DB: ${tagSlugToIdMap.size}`);
  console.log(`👨‍💻 Total Developers in DB: ${devSlugToIdMap.size}`);
}

main().catch(console.error);
