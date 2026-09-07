import "dotenv/config";
import { turso, initTursoForRequest, libsqlClient } from "../src/lib/turso";
initTursoForRequest(process.env);

async function runBenchmark() {
  console.log("=================================================");
  console.log("🔬 TURSO DB SEARCH & QUERY PERFORMANCE BENCHMARK");
  console.log("=================================================\n");

  // 1. Basic Ping / Round-Trip Latency
  const pingStart = performance.now();
  await libsqlClient.execute("SELECT 1");
  const pingTime = performance.now() - pingStart;
  console.log(`🌐 Base Network Round-Trip Latency (Ping): ${pingTime.toFixed(1)} ms\n`);

  // Helper to run, measure, and explain
  async function profileQuery(label: string, sqlQuery: string, args: any[] = []) {
    console.log(`--- [${label}] ---`);
    console.log(`SQL: ${sqlQuery.replace(/\s+/g, " ").trim()}`);

    // Explain query plan
    try {
      const plan = await libsqlClient.execute({ sql: `EXPLAIN QUERY PLAN ${sqlQuery}`, args });
      console.log("📋 Query Plan:");
      for (const row of plan.rows) {
        console.log(`   ${(row as any).detail || JSON.stringify(row)}`);
      }
    } catch (e: any) {
      console.log(`   ⚠️ EXPLAIN failed: ${e.message}`);
    }

    // Execution time measurement (3 runs)
    const times: number[] = [];
    let rowCount = 0;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const res = await libsqlClient.execute({ sql: sqlQuery, args });
      times.push(performance.now() - start);
      rowCount = res.rows.length;
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`⏱️ Exec Times: ${times.map(t => t.toFixed(1) + 'ms').join(', ')} (Avg: ${avgTime.toFixed(1)} ms)`);
    console.log(`📦 Returned Rows: ${rowCount}\n`);
    return avgTime;
  }

  // TEST 1: The Count Query for catalog
  await profileQuery(
    "1. Count Query (All Visible Games)",
    `SELECT count() FROM "Game" WHERE "status" IS NULL OR "status" != 'hidden'`
  );

  // TEST 2: Default Catalog Page (Sort: Trending, Limit 24)
  await profileQuery(
    "2. Default Catalog Page (Sort: Trending, Limit 24)",
    `SELECT * FROM "Game" 
     WHERE ("status" IS NULL OR "status" != 'hidden') 
       AND ("status" IS NULL OR "status" != 'upcoming')
       AND ("releaseDate" IS NULL OR "releaseDate" <= ?)
     ORDER BY "isTrending" DESC, COALESCE("popularity", 0) DESC, COALESCE("rating", 0) DESC, "likesCount" DESC, "id" DESC
     LIMIT 24`,
    [Date.now()]
  );

  // TEST 3: Search Count (Substring '%silent%')
  await profileQuery(
    "3. Search Count Query ('%silent%')",
    `SELECT count() FROM "Game" 
     WHERE ("status" IS NULL OR "status" != 'hidden')
       AND ("title" LIKE '%silent%' OR "developerNames" LIKE '%silent%' OR "slug" LIKE '%silent%')`
  );

  // TEST 4: Search Result Query (Substring '%silent%', Limit 24 with Custom Search Ranking)
  await profileQuery(
    "4. Search Result Query ('%silent%', Limit 24 with Ranking Order By)",
    `SELECT * FROM "Game" 
     WHERE ("status" IS NULL OR "status" != 'hidden')
       AND ("title" LIKE '%silent%' OR "developerNames" LIKE '%silent%' OR "slug" LIKE '%silent%')
     ORDER BY 
       CASE 
         WHEN LOWER("title") = 'silent' THEN 0
         WHEN LOWER("title") LIKE 'silent%' THEN 1
         WHEN LOWER("title") LIKE '%silent%' THEN 2
         ELSE 3
       END ASC,
       "isTrending" DESC, "popularity" DESC, "id" DESC
     LIMIT 24`
  );

  // TEST 5: Developer / Publisher pre-search lookup (Runs in /api/games for text searches)
  await profileQuery(
    "5. Developer Name Search ('%silent%')",
    `SELECT "id" FROM "Developer" WHERE "name" LIKE '%silent%'`
  );

  // TEST 6: Genre Filter Join
  await profileQuery(
    "6. Genre Filter Join ('adventure')",
    `SELECT g."A" as "gameId" FROM "_GameToGenre" g 
     INNER JOIN "Genre" ge ON g."B" = ge."id" 
     WHERE ge."slug" = 'adventure'`
  );

  // TEST 7: Tag Filter Join (e.g. 'psychological')
  await profileQuery(
    "7. Tag Filter Join ('psychological')",
    `SELECT t."A" as "gameId" FROM "_GameToTag" t 
     INNER JOIN "Tag" tg ON t."B" = tg."id" 
     WHERE tg."slug" = 'psychological'`
  );

  // TEST 8: Full End-to-End Search Simulation (/api/games workflow for search='silent')
  console.log("=================================================");
  console.log("🔄 SIMULATING FULL /api/games SEARCH WORKFLOW ('silent')");
  console.log("=================================================");

  const fullStart = performance.now();
  const stepTimes: Record<string, number> = {};

  // Step 1: Pre-fetch Devs & Pubs
  const s1Start = performance.now();
  const devRes = await libsqlClient.execute({ sql: `SELECT "id" FROM "Developer" WHERE "name" LIKE '%silent%'`, args: [] });
  const pubRes = await libsqlClient.execute({ sql: `SELECT "id" FROM "Publisher" WHERE "name" LIKE '%silent%'`, args: [] });
  stepTimes["1. Search Devs & Pubs (2 queries)"] = performance.now() - s1Start;

  // Step 2: Count Query
  const s2Start = performance.now();
  const countRes = await libsqlClient.execute({
    sql: `SELECT count() FROM "Game" WHERE ("status" IS NULL OR "status" != 'hidden') AND ("title" LIKE '%silent%' OR "developerNames" LIKE '%silent%' OR "slug" LIKE '%silent%')`,
    args: []
  });
  stepTimes["2. Count Query (1 full table scan)"] = performance.now() - s2Start;

  // Step 3: Main Games Query
  const s3Start = performance.now();
  const gamesRes = await libsqlClient.execute({
    sql: `SELECT * FROM "Game" 
          WHERE ("status" IS NULL OR "status" != 'hidden') 
            AND ("title" LIKE '%silent%' OR "developerNames" LIKE '%silent%' OR "slug" LIKE '%silent%')
          ORDER BY 
            CASE 
              WHEN LOWER("title") = 'silent' THEN 0
              WHEN LOWER("title") LIKE 'silent%' THEN 1
              WHEN LOWER("title") LIKE '%silent%' THEN 2
              ELSE 3
            END ASC,
            "isTrending" DESC, "popularity" DESC, "id" DESC
          LIMIT 24`,
    args: []
  });
  stepTimes["3. Main Games Fetch (1 full table scan + temp B-tree)"] = performance.now() - s3Start;

  const fetchedGameIds = gamesRes.rows.map((r: any) => r.id);

  // Step 4: Enrich Tags
  const s4Start = performance.now();
  if (fetchedGameIds.length > 0) {
    const placeholders = fetchedGameIds.map(() => "?").join(",");
    await libsqlClient.execute({
      sql: `SELECT g."A" as "gameId", t."name", t."slug" 
            FROM "_GameToTag" g 
            INNER JOIN "Tag" t ON g."B" = t."id" 
            WHERE g."A" IN (${placeholders})`,
      args: fetchedGameIds
    });
  }
  stepTimes["4. Enrich Tags"] = performance.now() - s4Start;

  // Step 5: Enrich Links
  const s5Start = performance.now();
  if (fetchedGameIds.length > 0) {
    const placeholders = fetchedGameIds.map(() => "?").join(",");
    await libsqlClient.execute({
      sql: `SELECT * FROM "PurchaseLink" WHERE "gameId" IN (${placeholders})`,
      args: fetchedGameIds
    });
  }
  stepTimes["5. Enrich Purchase Links"] = performance.now() - s5Start;

  // Step 6: Enrich Price Snapshots
  const s6Start = performance.now();
  if (fetchedGameIds.length > 0) {
    const placeholders = fetchedGameIds.map(() => "?").join(",");
    await libsqlClient.execute({
      sql: `SELECT * FROM "PriceSnapshot" WHERE "gameId" IN (${placeholders})`,
      args: fetchedGameIds
    });
  }
  stepTimes["6. Enrich Price Snapshots"] = performance.now() - s6Start;

  const totalWorkflowTime = performance.now() - fullStart;

  console.log("\n📊 Breakdown of Sequential Steps in Cloud Search:");
  for (const [step, time] of Object.entries(stepTimes)) {
    console.log(`   ${step}: ${time.toFixed(1)} ms`);
  }
  console.log(`\n🚨 TOTAL END-TO-END LATENCY: ${totalWorkflowTime.toFixed(1)} ms`);
  console.log("=================================================\n");

  // Check Existing Indexes on Game Table
  console.log("🔍 Checking Database Indexes on 'Game':");
  const indexes = await libsqlClient.execute(`PRAGMA index_list("Game")`);
  for (const idx of indexes.rows) {
    console.log(`   Index: ${(idx as any).name} (unique: ${(idx as any).unique})`);
    const info = await libsqlClient.execute(`PRAGMA index_info("${(idx as any).name}")`);
    const cols = info.rows.map((c: any) => c.name).join(", ");
    console.log(`      Columns: ${cols}`);
  }
}

runBenchmark().catch(err => {
  console.error("❌ Benchmark failed:", err);
  process.exit(1);
});
