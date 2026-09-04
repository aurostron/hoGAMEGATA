import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";

async function rollback() {
  const backupPath = path.resolve("C:/Users/bapum/Desktop/Portfolio/gamegata-astro/backups/dedup_snapshot_2026-09-04T16-18-03-588Z.json");
  console.log("🔄 Starting Rollback from:", backupPath);
  if (!fs.existsSync(backupPath)) {
    console.error("❌ Snapshot file not found!");
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  console.log(`Restoring ${snapshot.games.length} games to original status...`);

  // Un-hide all games in snapshot
  const gameIds = snapshot.games.map((g: any) => g.id);
  const chunkSize = 200;
  for (let i = 0; i < gameIds.length; i += chunkSize) {
    const chunk = gameIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    await rawDb.execute({
      sql: `UPDATE "Game" SET status = NULL WHERE id IN (${placeholders}) AND status = 'hidden'`,
      args: chunk
    });
    console.log(`Restored ${Math.min(i + chunkSize, gameIds.length)} / ${gameIds.length} games...`);
  }

  console.log("✅ Rollback completed successfully!");
}

rollback().catch(err => {
  console.error("❌ Rollback failed:", err);
  process.exit(1);
});
