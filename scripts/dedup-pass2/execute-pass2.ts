import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";
import type { InStatement } from "@libsql/client";

interface MergeItem {
  primarySlug: string;
  secondarySlugs: string[];
  reason: string;
}

async function main() {
  console.log("\n==================================================");
  console.log("🚀 PASS 2 DEDUPLICATION: LIVE TURSO DATABASE COMMIT");
  console.log("==================================================");

  const startTime = Date.now();
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pass2/data");
  const reportPath = path.join(dataDir, "pass2_dry_run_report.json");

  if (!fs.existsSync(reportPath)) {
    console.error("❌ Dry-run report missing! Run generate-report.ts first.");
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const poolAMerges = report.poolAMerges || [];
  const poolCMerges = report.poolCMerges || [];

  const mergePlan: MergeItem[] = [];

  for (const a of poolAMerges) {
    mergePlan.push({
      primarySlug: a.primarySlug,
      secondarySlugs: a.secondarySlugs,
      reason: "Punctuation/symbol normalization & studio match",
    });
  }

  for (const c of poolCMerges) {
    if (c.shouldMerge && c.primarySlug && c.mergeSlug) {
      mergePlan.push({
        primarySlug: c.primarySlug,
        secondarySlugs: [c.mergeSlug],
        reason: c.reason,
      });
    }
  }

  console.log(`📋 Total Approved Clusters to Commit: ${mergePlan.length}`);

  // Fetch Game records for all slugs in plan
  const allSlugs = new Set<string>();
  mergePlan.forEach((m) => {
    allSlugs.add(m.primarySlug);
    m.secondarySlugs.forEach((s) => allSlugs.add(s));
  });

  console.log(`🔍 Resolving ${allSlugs.size} distinct slugs from TursoDB...`);
  const slugArray = Array.from(allSlugs);
  const gameMap = new Map<string, any>();

  const CHUNK_SIZE = 100;
  for (let i = 0; i < slugArray.length; i += CHUNK_SIZE) {
    const chunk = slugArray.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    const res = await rawDb.execute({
      sql: `SELECT id, slug, title, status, "coverUrl", summary, "developerNames", "releaseDate", "scareRating" FROM "Game" WHERE slug IN (${placeholders})`,
      args: chunk,
    });
    res.rows.forEach((r) => gameMap.set(r.slug as string, r));
  }

  console.log(`✅ Loaded ${gameMap.size} games from database.`);

  let clustersApplied = 0;
  let gamesSoftHidden = 0;

  for (let idx = 0; idx < mergePlan.length; idx++) {
    const item = mergePlan[idx];
    const primary = gameMap.get(item.primarySlug);
    if (!primary) {
      console.warn(`⚠️ Primary game not found for slug: ${item.primarySlug}`);
      continue;
    }

    const validSecondaries: any[] = [];
    for (const secSlug of item.secondarySlugs) {
      const sec = gameMap.get(secSlug);
      if (sec && sec.id !== primary.id && sec.status !== "hidden") {
        validSecondaries.push(sec);
      }
    }

    if (validSecondaries.length === 0) continue;

    const stmts: InStatement[] = [];

    for (const sec of validSecondaries) {
      // 1. Delete duplicate purchase links
      stmts.push({
        sql: `DELETE FROM "PurchaseLink" WHERE "gameId" = ? AND "url" IN (SELECT "url" FROM "PurchaseLink" WHERE "gameId" = ?)`,
        args: [sec.id, primary.id],
      });

      // 2. Reparent remaining purchase links
      stmts.push({
        sql: `UPDATE "PurchaseLink" SET "gameId" = ? WHERE "gameId" = ?`,
        args: [primary.id, sec.id],
      });

      // 3. Delete duplicate price snapshots
      stmts.push({
        sql: `DELETE FROM "PriceSnapshot" WHERE "gameId" = ? AND ("storeName", "country") IN (SELECT "storeName", "country" FROM "PriceSnapshot" WHERE "gameId" = ?)`,
        args: [sec.id, primary.id],
      });

      // 4. Reparent remaining price snapshots
      stmts.push({
        sql: `UPDATE "PriceSnapshot" SET "gameId" = ? WHERE "gameId" = ?`,
        args: [primary.id, sec.id],
      });

      // 5. Merge Relations
      // Developers (A = devId, B = gameId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_DeveloperToGame" ("A", "B") SELECT "A", ? FROM "_DeveloperToGame" WHERE "B" = ?`,
        args: [primary.id, sec.id],
      });
      stmts.push({
        sql: `DELETE FROM "_DeveloperToGame" WHERE "B" = ?`,
        args: [sec.id],
      });

      // Genres (A = gameId, B = genreId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_GameToGenre" ("A", "B") SELECT ?, "B" FROM "_GameToGenre" WHERE "A" = ?`,
        args: [primary.id, sec.id],
      });
      stmts.push({
        sql: `DELETE FROM "_GameToGenre" WHERE "A" = ?`,
        args: [sec.id],
      });

      // Tags (A = gameId, B = tagId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_GameToTag" ("A", "B") SELECT ?, "B" FROM "_GameToTag" WHERE "A" = ?`,
        args: [primary.id, sec.id],
      });
      stmts.push({
        sql: `DELETE FROM "_GameToTag" WHERE "A" = ?`,
        args: [sec.id],
      });

      // Platforms (A = gameId, B = platformId)
      stmts.push({
        sql: `INSERT OR IGNORE INTO "_GameToPlatform" ("A", "B") SELECT ?, "B" FROM "_GameToPlatform" WHERE "A" = ?`,
        args: [primary.id, sec.id],
      });
      stmts.push({
        sql: `DELETE FROM "_GameToPlatform" WHERE "A" = ?`,
        args: [sec.id],
      });

      // 6. Enrich primary metadata if secondary has richer values
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
          args: setArgs,
        });
      }

      // 7. Soft-hide secondary
      stmts.push({
        sql: `UPDATE "Game" SET status = 'hidden', updatedAt = unixepoch() WHERE id = ?`,
        args: [sec.id],
      });

      gamesSoftHidden++;
    }

    if (stmts.length > 0) {
      await rawDb.batch(stmts, "write");
      clustersApplied++;
      console.log(`  [${clustersApplied}/${mergePlan.length}] Consolidated into "${primary.title}" (${primary.slug})`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`🏁 PASS 2 COMMIT FINISHED (COMMITTED TO TURSO)`);
  console.log(`==================================================`);
  console.log(`📁 Clusters Consolidated:     ${clustersApplied} / ${mergePlan.length}`);
  console.log(`🙈 Duplicate Games Hidden:     ${gamesSoftHidden}`);
  console.log(`⏱️ Duration:                   ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Query updated active count
  const countRes = await rawDb.execute(`SELECT count(*) as count FROM "Game" WHERE status IS NULL OR status != 'hidden'`);
  const activeCount = countRes.rows[0].count;
  console.log(`🎮 Total Active Visible Games: ${activeCount}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Commit error:", err);
  process.exit(1);
});
