import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const c = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });

  console.log("=== Testing Catalog Query Counts in Turso ===");

  // 1. Total games in DB
  const total = await c.execute("SELECT count(*) as count FROM Game");
  console.log("1. Total games in DB:", total.rows[0].count);

  // 2. Total games without releaseDate filter restriction
  const releasedAll = await c.execute(`
    SELECT count(*) as count 
    FROM Game 
    WHERE (status IS NULL OR status != 'hidden')
      AND (status IS NULL OR status != 'upcoming')
      AND (releaseDate IS NULL OR releaseDate <= strftime('%s', 'now') * 1000)
  `);
  console.log("2. Released catalog games (including NULL release dates):", releasedAll.rows[0].count);

  // 3. With hideDlcs=true
  const hideDlcsAll = await c.execute(`
    SELECT count(*) as count 
    FROM Game 
    WHERE (status IS NULL OR status != 'hidden')
      AND (status IS NULL OR status != 'upcoming')
      AND (releaseDate IS NULL OR releaseDate <= strftime('%s', 'now') * 1000)
      AND (category IS NULL OR category NOT IN (1, 2, 3, 10, 13))
  `);
  console.log("3. Hide DLCs catalog games:", hideDlcsAll.rows[0].count);

  // 4. Sample latest page query with limit=24
  const latestGames = await c.execute(`
    SELECT id, title, slug, releaseDate, developerNames
    FROM Game
    WHERE (status IS NULL OR status != 'hidden')
      AND (status IS NULL OR status != 'upcoming')
      AND (releaseDate IS NULL OR releaseDate <= strftime('%s', 'now') * 1000)
      AND (category IS NULL OR category NOT IN (1, 2, 3, 10, 13))
    ORDER BY 
      CASE WHEN releaseDate IS NOT NULL THEN 0 ELSE 1 END,
      releaseDate DESC,
      id DESC
    LIMIT 5
  `);
  console.log("\n4. Sample Latest Games:", latestGames.rows);
}

main().catch(console.error);
