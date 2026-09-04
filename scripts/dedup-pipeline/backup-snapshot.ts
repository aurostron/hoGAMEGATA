import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb, turso, schema } from "./client";
import { inArray } from "drizzle-orm";

async function main() {
  console.log("\n==================================================");
  console.log("🛡️  PHASE 1: PRE-FLIGHT SAFETY BACKUP SNAPSHOT");
  console.log("==================================================");
  const startTime = Date.now();

  // 1. Find all title groups with count > 1
  console.log("📊 Step 1: Identifying duplicate candidate title groups...");
  const groupQuery = await rawDb.execute(`
    SELECT lower(trim(title)) as norm_title, count(*) as cnt
    FROM "Game"
    WHERE (status IS NULL OR status != 'hidden')
    GROUP BY lower(trim(title))
    HAVING cnt > 1
    ORDER BY cnt DESC
  `);

  const duplicateCount = groupQuery.rows.length;
  console.log(`✅ Identified ${duplicateCount} duplicate candidate title groups.`);

  // 2. Fetch candidate game rows
  console.log("📦 Step 2: Fetching full records for all candidate games...");
  const allCandidateGames = await rawDb.execute(`
    SELECT * FROM "Game"
    WHERE (status IS NULL OR status != 'hidden')
      AND lower(trim(title)) IN (
        SELECT lower(trim(title))
        FROM "Game"
        WHERE (status IS NULL OR status != 'hidden')
        GROUP BY lower(trim(title))
        HAVING count(*) > 1
      )
  `);

  const games = allCandidateGames.rows;
  const gameIds = games.map((g: any) => String(g.id));
  console.log(`✅ Retrieved ${games.length} total game records across ${duplicateCount} groups.`);

  // 3. Fetch related relations in chunks of 500
  console.log("🔗 Step 3: Fetching related foreign-key rows (purchase links, prices, relations)...");
  const chunkSize = 500;

  const purchaseLinks: any[] = [];
  const priceSnapshots: any[] = [];
  const gamesToDevs: any[] = [];
  const gamesToGen: any[] = [];
  const gamesToTag: any[] = [];
  const gamesToPlat: any[] = [];

  for (let i = 0; i < gameIds.length; i += chunkSize) {
    const chunk = gameIds.slice(i, i + chunkSize);

    const [links, prices, devs, genres, tags, plats] = await Promise.all([
      turso.select().from(schema.purchaseLinks).where(inArray(schema.purchaseLinks.gameId, chunk)),
      turso.select().from(schema.priceSnapshots).where(inArray(schema.priceSnapshots.gameId, chunk)),
      turso.select().from(schema.gamesToDevelopers).where(inArray(schema.gamesToDevelopers.gameId, chunk)),
      turso.select().from(schema.gamesToGenres).where(inArray(schema.gamesToGenres.gameId, chunk)),
      turso.select().from(schema.gamesToTags).where(inArray(schema.gamesToTags.gameId, chunk)),
      turso.select().from(schema.gamesToPlatforms).where(inArray(schema.gamesToPlatforms.gameId, chunk)),
    ]);

    purchaseLinks.push(...links);
    priceSnapshots.push(...prices);
    gamesToDevs.push(...devs);
    gamesToGen.push(...genres);
    gamesToTag.push(...tags);
    gamesToPlat.push(...plats);

    process.stdout.write(`\r   Fetched relations for ${Math.min(i + chunkSize, gameIds.length)} / ${gameIds.length} games...`);
  }
  console.log("\n✅ All relation rows fetched successfully.");

  // 4. Save to backups directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `dedup_snapshot_${timestamp}.json`;
  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, backupFilename);

  const snapshotData = {
    createdAt: new Date().toISOString(),
    totalDuplicateGroups: duplicateCount,
    totalGames: games.length,
    games,
    purchaseLinks,
    priceSnapshots,
    gamesToDevelopers: gamesToDevs,
    gamesToGenres: gamesToGen,
    gamesToTags: gamesToTag,
    gamesToPlatforms: gamesToPlat,
  };

  fs.writeFileSync(backupPath, JSON.stringify(snapshotData, null, 2), "utf-8");
  const sizeMb = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2);

  // 5. Generate rollback script
  const rollbackScriptContent = `import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";

async function rollback() {
  const backupPath = path.resolve("${backupPath.replace(/\\/g, "/")}");
  console.log("🔄 Starting Rollback from:", backupPath);
  if (!fs.existsSync(backupPath)) {
    console.error("❌ Snapshot file not found!");
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  console.log(\`Restoring \${snapshot.games.length} games to original status...\`);

  // Un-hide all games in snapshot
  const gameIds = snapshot.games.map((g: any) => g.id);
  const chunkSize = 200;
  for (let i = 0; i < gameIds.length; i += chunkSize) {
    const chunk = gameIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    await rawDb.execute({
      sql: \`UPDATE "Game" SET status = NULL WHERE id IN (\${placeholders}) AND status = 'hidden'\`,
      args: chunk
    });
    console.log(\`Restored \${Math.min(i + chunkSize, gameIds.length)} / \${gameIds.length} games...\`);
  }

  console.log("✅ Rollback completed successfully!");
}

rollback().catch(err => {
  console.error("❌ Rollback failed:", err);
  process.exit(1);
});
`;
  const rollbackPath = path.resolve(process.cwd(), "scripts/dedup-pipeline/rollback.ts");
  fs.writeFileSync(rollbackPath, rollbackScriptContent, "utf-8");

  console.log(`\n==================================================`);
  console.log(`🎉 PRE-FLIGHT SNAPSHOT SAVED SUCCESSFULLY!`);
  console.log(`==================================================`);
  console.log(`📁 Snapshot Location:  ${backupPath} (${sizeMb} MB)`);
  console.log(`🎮 Candidate Games:     ${games.length}`);
  console.log(`🔗 Purchase Links:      ${purchaseLinks.length}`);
  console.log(`💲 Price Snapshots:     ${priceSnapshots.length}`);
  console.log(`👨‍💻 Developer Links:     ${gamesToDevs.length}`);
  console.log(`🏷️ Genre Links:         ${gamesToGen.length}`);
  console.log(`🔖 Tag Links:           ${gamesToTag.length}`);
  console.log(`🖥️ Platform Links:      ${gamesToPlat.length}`);
  console.log(`🛡️ Rollback Script:     scripts/dedup-pipeline/rollback.ts`);
  console.log(`⏱️ Duration:            ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("❌ Snapshot failed:", err);
  process.exit(1);
});
