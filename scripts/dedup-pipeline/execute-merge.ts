import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";
import type { InStatement } from "@libsql/client";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("\n==================================================");
  console.log(`⚡ HIGH-SPEED BATCHED DEDUPLICATION ENGINE ${dryRun ? "(DRY RUN)" : "(LIVE)"}`);
  console.log("==================================================");

  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pipeline/data");
  const finalMergesPath = path.join(dataDir, "final_merges.json");
  if (!fs.existsSync(finalMergesPath)) {
    console.error("❌ final_merges.json not found!");
    process.exit(1);
  }

  const clusters: any[] = JSON.parse(fs.readFileSync(finalMergesPath, "utf-8"));
  console.log(`📋 Total Clusters to Merge:      ${clusters.length}`);
  const totalSecondaries = clusters.reduce((sum, c) => sum + c.secondaries.length, 0);
  console.log(`🎮 Total Secondary Games to Hide: ${totalSecondaries}`);

  const startTime = Date.now();
  let completedClusters = 0;
  let hiddenCount = 0;

  // Process clusters in concurrent chunks of 5
  const concurrency = 5;

  async function processCluster(cluster: any, index: number) {
    const { primary, secondaries, source } = cluster;
    const stmts: InStatement[] = [];

    for (const sec of secondaries) {
      if (sec.id === primary.id) continue;

      // 1. Delete duplicate purchase links
      stmts.push({
        sql: `DELETE FROM "PurchaseLink" WHERE "gameId" = ? AND "url" IN (SELECT "url" FROM "PurchaseLink" WHERE "gameId" = ?)`,
        args: [sec.id, primary.id]
      });

      // 2. Reparent remaining purchase links
      stmts.push({
        sql: `UPDATE "PurchaseLink" SET "gameId" = ? WHERE "gameId" = ?`,
        args: [primary.id, sec.id]
      });

      // 3. Delete duplicate price snapshots
      stmts.push({
        sql: `DELETE FROM "PriceSnapshot" WHERE "gameId" = ? AND ("storeName", "country") IN (SELECT "storeName", "country" FROM "PriceSnapshot" WHERE "gameId" = ?)`,
        args: [sec.id, primary.id]
      });

      // 4. Reparent remaining price snapshots
      stmts.push({
        sql: `UPDATE "PriceSnapshot" SET "gameId" = ? WHERE "gameId" = ?`,
        args: [primary.id, sec.id]
      });

      // 5. Merge Relations
      // Developers (A = devId, B = gameId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_DeveloperToGame" ("A", "B") SELECT "A", ? FROM "_DeveloperToGame" WHERE "B" = ?`,
        args: [primary.id, sec.id]
      });
      stmts.push({
        sql: `DELETE FROM "_DeveloperToGame" WHERE "B" = ?`,
        args: [sec.id]
      });

      // Genres (A = gameId, B = genreId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_GameToGenre" ("A", "B") SELECT ?, "B" FROM "_GameToGenre" WHERE "A" = ?`,
        args: [primary.id, sec.id]
      });
      stmts.push({
        sql: `DELETE FROM "_GameToGenre" WHERE "A" = ?`,
        args: [sec.id]
      });

      // Tags (A = gameId, B = tagId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_GameToTag" ("A", "B") SELECT ?, "B" FROM "_GameToTag" WHERE "A" = ?`,
        args: [primary.id, sec.id]
      });
      stmts.push({
        sql: `DELETE FROM "_GameToTag" WHERE "A" = ?`,
        args: [sec.id]
      });

      // Platforms (A = gameId, B = platformId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_GameToPlatform" ("A", "B") SELECT ?, "B" FROM "_GameToPlatform" WHERE "A" = ?`,
        args: [primary.id, sec.id]
      });
      stmts.push({
        sql: `DELETE FROM "_GameToPlatform" WHERE "A" = ?`,
        args: [sec.id]
      });

      // 6. Enrich primary metadata
      const setClauses: string[] = [];
      const setArgs: any[] = [];
      if (!primary.coverUrl && sec.coverUrl) {
        setClauses.push('"coverUrl" = ?');
        setArgs.push(sec.coverUrl);
      }
      if ((!primary.summary || primary.summary.length < 30) && (sec.summary && sec.summary.length > 30)) {
        setClauses.push('"summary" = ?');
        setArgs.push(sec.summary);
      }
      if (!primary.developerNames && sec.developerNames) {
        setClauses.push('"developerNames" = ?');
        setArgs.push(sec.developerNames);
      }
      if (!primary.releaseDate && sec.releaseDate) {
        setClauses.push('"releaseDate" = ?');
        setArgs.push(sec.releaseDate);
      }
      if (primary.scareRating === null && sec.scareRating !== null) {
        setClauses.push('"scareRating" = ?');
        setArgs.push(sec.scareRating);
      }

      if (setClauses.length > 0) {
        setArgs.push(primary.id);
        stmts.push({
          sql: `UPDATE "Game" SET ${setClauses.join(", ")}, "updatedAt" = unixepoch() WHERE id = ?`,
          args: setArgs
        });
      }

      // 7. Soft-hide secondary
      stmts.push({
        sql: `UPDATE "Game" SET status = 'hidden', updatedAt = unixepoch() WHERE id = ?`,
        args: [sec.id]
      });

      hiddenCount++;
    }

    if (!dryRun && stmts.length > 0) {
      await rawDb.batch(stmts, "write");
    }

    completedClusters++;
    if (completedClusters % 25 === 0 || completedClusters === clusters.length) {
      console.log(`   [${completedClusters}/${clusters.length}] Merged into "${primary.title}" (${primary.slug}) [${source}]`);
    }
  }

  for (let i = 0; i < clusters.length; i += concurrency) {
    const chunk = clusters.slice(i, i + concurrency);
    await Promise.all(chunk.map((c, idx) => processCluster(c, i + idx)));
  }

  console.log(`\n==================================================`);
  console.log(`🏁 DEDUPLICATION FINISHED ${dryRun ? "(DRY RUN)" : "(COMMITTED TO TURSO)"}`);
  console.log(`==================================================`);
  console.log(`📁 Clusters Processed:       ${completedClusters} / ${clusters.length}`);
  console.log(`🙈 Secondary Games Hidden:    ${hiddenCount} / ${totalSecondaries}`);
  console.log(`⏱️ Duration:                  ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("❌ Fatal Execution Error:", err);
  process.exit(1);
});
