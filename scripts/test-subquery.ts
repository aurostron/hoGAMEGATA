import "dotenv/config";
import { initTursoForRequest, libsqlClient } from "../src/lib/turso";
initTursoForRequest(process.env);

async function testSubqueryVsInArray() {
  console.log("Comparing IN (10k params) vs SQL Subquery / JOIN...");

  // Method 1: Current Way (Fetch IDs over network, pass into IN)
  const t1 = performance.now();
  const genreRows = await libsqlClient.execute("SELECT g.A as gameId FROM _GameToGenre g INNER JOIN Genre ge ON g.B = ge.id WHERE ge.slug = 'adventure'");
  const gameIds = genreRows.rows.map((r: any) => r.gameId);
  const fetchIdsTime = performance.now() - t1;

  console.log(`Fetched ${gameIds.length} game IDs in ${fetchIdsTime.toFixed(1)} ms`);

  // Method 2: Subquery directly in SQL (No IDs transferred over the wire!)
  const t2 = performance.now();
  const subqueryRes = await libsqlClient.execute(`
    SELECT * FROM "Game"
    WHERE ("status" IS NULL OR "status" != 'hidden')
      AND "id" IN (
        SELECT g."A" FROM "_GameToGenre" g
        INNER JOIN "Genre" ge ON g."B" = ge."id"
        WHERE ge."slug" = 'adventure'
      )
    ORDER BY "isTrending" DESC, "popularity" DESC, "id" DESC
    LIMIT 24
  `);
  const subqueryTime = performance.now() - t2;
  console.log(`⚡ Direct SQL Subquery (Zero IDs over network): ${subqueryTime.toFixed(1)} ms (Returned ${subqueryRes.rows.length} rows)`);

  // Explain query plan of direct subquery
  const plan = await libsqlClient.execute(`
    EXPLAIN QUERY PLAN
    SELECT * FROM "Game"
    WHERE ("status" IS NULL OR "status" != 'hidden')
      AND "id" IN (
        SELECT g."A" FROM "_GameToGenre" g
        INNER JOIN "Genre" ge ON g."B" = ge."id"
        WHERE ge."slug" = 'adventure'
      )
    ORDER BY "isTrending" DESC, "popularity" DESC, "id" DESC
    LIMIT 24
  `);
  console.log("Query Plan for Direct Subquery:");
  for (const row of plan.rows) {
    console.log(`   ${(row as any).detail}`);
  }
}

testSubqueryVsInArray();
