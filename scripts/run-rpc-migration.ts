import { Client } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually
const envFile = readFileSync(resolve(__dirname, "../.env"), "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.substring(0, eqIdx).trim();
  let value = trimmed.substring(eqIdx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
  }

  console.log("Connecting to:", connStr.replace(/:[^:@]+@/, ":***@"));

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to database\n");

  const sql = readFileSync(resolve(__dirname, "sql/rpc_functions.sql"), "utf-8");

  try {
    await client.query(sql);
    console.log("✓ All RPC functions created successfully!");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log("⚠ Some functions already exist. Dropping and recreating...");
      
      // Drop all functions first, then recreate
      const dropSql = `
        DROP FUNCTION IF EXISTS search_games_exact(TEXT, INT);
        DROP FUNCTION IF EXISTS search_games_semantic(TEXT, TEXT, INT);
        DROP FUNCTION IF EXISTS random_games(TEXT[], INT);
        DROP FUNCTION IF EXISTS get_cheapest_snapshots(TEXT[]);
        DROP FUNCTION IF EXISTS get_db_stats();
        DROP FUNCTION IF EXISTS random_game_slug();
        DROP FUNCTION IF EXISTS health_check();
        DROP FUNCTION IF EXISTS upsert_user_safe(TEXT, TEXT, INT);
      `;
      await client.query(dropSql);
      console.log("  Dropped old functions");
      
      await client.query(sql);
      console.log("✓ All RPC functions recreated successfully!");
    } else {
      console.error("✗ Migration failed:", err.message);
    }
  }

  // Verify functions exist
  const { rows } = await client.query(`
    SELECT proname FROM pg_proc 
    WHERE proname IN (
      'search_games_exact', 'search_games_semantic', 'random_games',
      'get_cheapest_snapshots', 'get_db_stats', 'random_game_slug',
      'health_check', 'upsert_user_safe'
    )
    ORDER BY proname;
  `);

  console.log(`\nVerified ${rows.length}/8 functions exist:`);
  for (const row of rows) {
    console.log(`  ✓ ${row.proname}`);
  }

  await client.end();
  console.log("\nDone!");
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
