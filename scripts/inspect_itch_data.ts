import { createClient } from "@libsql/client";
import * as path from "path";
import * as fs from "fs";

async function main() {
  const dataDir = path.resolve(process.cwd(), "data");
  
  console.log("=== 1. Inspecting itch-horror.db ===");
  const itchDbPath = path.join(dataDir, "itch-horror.db");
  if (fs.existsSync(itchDbPath)) {
    const itchClient = createClient({ url: `file:${itchDbPath.replace(/\\/g, '/')}` });
    const tables = await itchClient.execute("SELECT name FROM sqlite_master WHERE type='table';");
    console.log("Tables in itch-horror.db:", tables.rows);

    for (const row of tables.rows) {
      const tableName = String(row.name);
      if (tableName.startsWith("sqlite_")) continue;
      const countRes = await itchClient.execute(`SELECT count(*) as cnt FROM "${tableName}"`);
      console.log(`Table ${tableName} count:`, countRes.rows[0]);
      const tableInfo = await itchClient.execute(`PRAGMA table_info("${tableName}")`);
      console.log(`Schema for ${tableName}:`, tableInfo.rows);
      const samples = await itchClient.execute(`SELECT * FROM "${tableName}" LIMIT 3`);
      console.log(`Samples from ${tableName}:`, JSON.stringify(samples.rows, null, 2));
    }
  } else {
    console.log("itch-horror.db not found");
  }

  console.log("\n=== 2. Inspecting gamegata-db.db ===");
  const gamegataDbPath = path.join(dataDir, "gamegata-db.db");
  if (fs.existsSync(gamegataDbPath)) {
    const gClient = createClient({ url: `file:${gamegataDbPath.replace(/\\/g, '/')}` });
    const tables = await gClient.execute("SELECT name FROM sqlite_master WHERE type='table';");
    console.log("Tables in gamegata-db.db:", tables.rows.map(r => r.name));
    
    // Check game count and sample
    const gameCount = await gClient.execute('SELECT count(*) as cnt FROM "Game"');
    console.log("Game table count in gamegata-db.db:", gameCount.rows[0]);

    // Check existing itch games in Game table
    const itchInGamegata = await gClient.execute("SELECT count(*) as cnt FROM \"Game\" WHERE slug LIKE 'itch-%' OR source = 'itch' OR id LIKE 'itch_%'");
    console.log("Existing itch games in gamegata-db.db:", itchInGamegata.rows[0]);

    // Sample games
    const sampleGames = await gClient.execute('SELECT id, title, slug, source, coverUrl, developerNames, status FROM "Game" LIMIT 3');
    console.log("Sample Game rows:", JSON.stringify(sampleGames.rows, null, 2));
  }

  console.log("\n=== 3. Inspecting itch-horror.csv header ===");
  const csvPath = path.join(dataDir, "itch-horror.csv");
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n").slice(0, 5);
    console.log("First 5 lines of itch-horror.csv:");
    lines.forEach((l, idx) => console.log(`[${idx}]: ${l}`));
  }
}

main().catch(console.error);
