import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb, turso, schema } from "./client";
import { inArray } from "drizzle-orm";

function extractStoreId(url: string): string | null {
  if (!url) return null;
  const steamMatch = url.match(/store\.steampowered\.com\/app\/(\d+)/);
  if (steamMatch) return `steam:${steamMatch[1]}`;
  const gogMatch = url.match(/gog\.com\/(?:[a-z]{2}\/)?game\/([a-z0-9_]+)/);
  if (gogMatch) return `gog:${gogMatch[1]}`;
  const itchMatch = url.match(/https?:\/\/([a-z0-9-_]+\.itch\.io\/[a-z0-9-_]+)/i);
  if (itchMatch) return `itch:${itchMatch[1].toLowerCase()}`;
  return null;
}

async function main() {
  console.log("\n==================================================");
  console.log("🛡️  PASS 2: MULTI-ANGLE CANDIDATE DISCOVERY SNAPSHOT");
  console.log("==================================================");
  const startTime = Date.now();

  // 1. Fetch active games (minimal for grouping)
  console.log("📊 Step 1: Querying all visible active games...");
  const activeGamesRes = await rawDb.execute(`
    SELECT id, title, slug, coverUrl, developerNames, releaseDate, status, summary, storyline, scareRating, source, platformNames
    FROM "Game"
    WHERE (status IS NULL OR status != 'hidden')
  `);

  const allActive = activeGamesRes.rows;
  console.log(`📦 Found ${allActive.length} active games in TursoDB.`);

  // 2. Fetch all purchase links
  console.log("🔗 Step 2: Querying all purchase links...");
  const allLinksRes = await rawDb.execute(`
    SELECT id, gameId, storeName, url
    FROM "PurchaseLink"
  `);
  const allLinks = allLinksRes.rows;
  console.log(`🔗 Found ${allLinks.length} total purchase links.`);

  // Map links by gameId
  const linksByGame = new Map<string, any[]>();
  for (const l of allLinks) {
    const gid = String(l.gameId);
    if (!linksByGame.has(gid)) linksByGame.set(gid, []);
    linksByGame.get(gid)!.push(l);
  }

  // 3. Multi-Angle Discovery
  console.log("🔍 Step 3: Running 3-way candidate discovery...");

  // Channel 1: Exact normalized title collisions
  const byExactTitle = new Map<string, any[]>();
  // Channel 2: Alphanumeric normalized title collisions (stripping punctuation/symbols)
  const byAlphaTitle = new Map<string, any[]>();
  // Channel 3: Shared Storefront AppID / URL collisions
  const byStoreId = new Map<string, any[]>();

  const normalizeAlpha = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const g of allActive) {
    const exactKey = (g.title || "").toLowerCase().trim();
    const alphaKey = normalizeAlpha(g.title);

    if (exactKey) {
      if (!byExactTitle.has(exactKey)) byExactTitle.set(exactKey, []);
      byExactTitle.get(exactKey)!.push(g);
    }

    if (alphaKey && alphaKey.length > 2) {
      if (!byAlphaTitle.has(alphaKey)) byAlphaTitle.set(alphaKey, []);
      byAlphaTitle.get(alphaKey)!.push(g);
    }

    const gLinks = linksByGame.get(String(g.id)) || [];
    for (const link of gLinks) {
      const storeId = extractStoreId(link.url);
      if (storeId) {
        if (!byStoreId.has(storeId)) byStoreId.set(storeId, []);
        byStoreId.get(storeId)!.push(g);
      }
    }
  }

  // Collect candidate game IDs from all 3 channels
  const candidateIds = new Set<string>();

  let exactGroupsCount = 0;
  for (const [key, list] of byExactTitle.entries()) {
    if (list.length > 1) {
      exactGroupsCount++;
      list.forEach((g: any) => candidateIds.add(String(g.id)));
    }
  }

  let alphaGroupsCount = 0;
  for (const [key, list] of byAlphaTitle.entries()) {
    if (list.length > 1) {
      alphaGroupsCount++;
      list.forEach((g: any) => candidateIds.add(String(g.id)));
    }
  }

  let storeIdGroupsCount = 0;
  for (const [key, list] of byStoreId.entries()) {
    if (list.length > 1) {
      storeIdGroupsCount++;
      list.forEach((g: any) => candidateIds.add(String(g.id)));
    }
  }

  console.log(`\nCandidate Discovery Stats:`);
  console.log(`  - Exact Title Collision Groups:        ${exactGroupsCount}`);
  console.log(`  - Alphanumeric Punctuation Groups:      ${alphaGroupsCount}`);
  console.log(`  - Shared Storefront AppID/URL Groups:   ${storeIdGroupsCount}`);
  console.log(`🎯 Total Unique Candidate Games Flagged: ${candidateIds.size}`);

  // 4. Extract candidate game records & associated relations
  const candidateGames = allActive.filter((g: any) => candidateIds.has(String(g.id)));
  const candidateIdList = Array.from(candidateIds);

  console.log("\n📦 Step 4: Fetching relations for candidate games in parallel chunks...");
  const chunkSize = 500;
  const purchaseLinks: any[] = [];
  const priceSnapshots: any[] = [];
  const gamesToDevs: any[] = [];

  for (let i = 0; i < candidateIdList.length; i += chunkSize) {
    const chunk = candidateIdList.slice(i, i + chunkSize);

    const [links, prices, devs] = await Promise.all([
      turso.select().from(schema.purchaseLinks).where(inArray(schema.purchaseLinks.gameId, chunk)),
      turso.select().from(schema.priceSnapshots).where(inArray(schema.priceSnapshots.gameId, chunk)),
      turso.select().from(schema.gamesToDevelopers).where(inArray(schema.gamesToDevelopers.gameId, chunk)),
    ]);

    purchaseLinks.push(...links);
    priceSnapshots.push(...prices);
    gamesToDevs.push(...devs);

    process.stdout.write(`\r   Fetched relations for ${Math.min(i + chunkSize, candidateIdList.length)} / ${candidateIdList.length} games...`);
  }
  console.log("\n✅ Relations fetched successfully.");

  // 5. Save Snapshot to backups/pass2/
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.resolve(process.cwd(), `backups/pass2/snapshot_pass2_${timestamp}.json`);
  const snapshotData = {
    createdAt: new Date().toISOString(),
    totalActiveGamesInDb: allActive.length,
    totalCandidateGames: candidateGames.length,
    exactGroupsCount,
    alphaGroupsCount,
    storeIdGroupsCount,
    candidateGames,
    purchaseLinks,
    priceSnapshots,
    gamesToDevelopers: gamesToDevs,
  };

  fs.writeFileSync(backupPath, JSON.stringify(snapshotData, null, 2), "utf-8");
  const sizeMb = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2);

  console.log(`\n==================================================`);
  console.log(`🎉 PASS 2 SNAPSHOT COMPLETED!`);
  console.log(`==================================================`);
  console.log(`📁 File Location:       ${backupPath} (${sizeMb} MB)`);
  console.log(`🎮 Candidate Games:     ${candidateGames.length}`);
  console.log(`🔗 Purchase Links:      ${purchaseLinks.length}`);
  console.log(`💲 Price Snapshots:     ${priceSnapshots.length}`);
  console.log(`⏱️ Duration:            ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("❌ Snapshot error:", err);
  process.exit(1);
});
