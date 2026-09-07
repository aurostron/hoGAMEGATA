import "dotenv/config";
import { initTursoForRequest, libsqlClient } from "../src/lib/turso";
initTursoForRequest(process.env);

async function testFts5Setup() {
  console.log("Testing FTS5 Virtual Table on Turso...");

  try {
    // 1. Create FTS5 virtual table
    await libsqlClient.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS "Game_fts" USING fts5(
        id UNINDEXED,
        title,
        developerNames,
        tokenize = 'unicode61'
      );
    `);
    console.log("✅ Created Game_fts virtual table");

    // 2. Check if populated
    const countRes = await libsqlClient.execute('SELECT count() as c FROM "Game_fts"');
    const existingCount = (countRes.rows[0] as any).c;
    console.log(`Current rows in Game_fts: ${existingCount}`);

    if (existingCount === 0) {
      console.log("Populating Game_fts from Game table (visible only)...");
      const insertStart = performance.now();
      await libsqlClient.execute(`
        INSERT INTO "Game_fts"(id, title, developerNames)
        SELECT id, title, COALESCE(developerNames, '')
        FROM "Game"
        WHERE status IS NULL OR status != 'hidden'
      `);
      console.log(`✅ Populated Game_fts in ${(performance.now() - insertStart).toFixed(1)} ms`);
    }

    // 3. Test FTS5 search speed
    const searchStart = performance.now();
    const ftsRes = await libsqlClient.execute({
      sql: `SELECT id, rank FROM "Game_fts" WHERE "Game_fts" MATCH 'silent*' ORDER BY rank LIMIT 24`,
      args: []
    });
    const searchTime = performance.now() - searchStart;
    console.log(`⚡ FTS5 MATCH 'silent*' query time: ${searchTime.toFixed(1)} ms (Found ${ftsRes.rows.length} rows)`);

    // 4. Test joined query with Game
    const joinStart = performance.now();
    const joinRes = await libsqlClient.execute({
      sql: `SELECT g.* FROM "Game_fts" f
            INNER JOIN "Game" g ON f.id = g.id
            WHERE "Game_fts" MATCH 'silent*'
            ORDER BY f.rank
            LIMIT 24`,
      args: []
    });
    const joinTime = performance.now() - joinStart;
    console.log(`⚡ FTS5 Joined with Game time: ${joinTime.toFixed(1)} ms (Returned ${joinRes.rows.length} full games)`);

    // Explain query plan
    const plan = await libsqlClient.execute(`
      EXPLAIN QUERY PLAN
      SELECT g.id, g.title FROM "Game_fts" f
      INNER JOIN "Game" g ON f.id = g.id
      WHERE "Game_fts" MATCH 'silent*'
      ORDER BY f.rank
      LIMIT 24
    `);
    console.log("📋 FTS5 Query Plan:");
    for (const row of plan.rows) {
      console.log(`   ${(row as any).detail}`);
    }

  } catch (e: any) {
    console.error("❌ FTS5 setup failed:", e.message);
  }
}

testFts5Setup();
