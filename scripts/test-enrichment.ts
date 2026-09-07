import "dotenv/config";
import { initTursoForRequest, libsqlClient } from "../src/lib/turso";
initTursoForRequest(process.env);

async function testEnrichment() {
  // Grab 24 real game IDs
  const gamesRes = await libsqlClient.execute("SELECT id FROM Game LIMIT 24");
  const gameIds = gamesRes.rows.map((r: any) => r.id);
  const placeholders = gameIds.map(() => "?").join(",");

  console.log(`Testing enrichment on ${gameIds.length} game IDs...`);

  // 1. Sequential (Current way)
  const seqStart = performance.now();
  await libsqlClient.execute({
    sql: `SELECT g."A" as "gameId", t."name", t."slug" FROM "_GameToTag" g INNER JOIN "Tag" t ON g."B" = t."id" WHERE g."A" IN (${placeholders})`,
    args: gameIds
  });
  await libsqlClient.execute({
    sql: `SELECT * FROM "PurchaseLink" WHERE "gameId" IN (${placeholders})`,
    args: gameIds
  });
  await libsqlClient.execute({
    sql: `SELECT * FROM "PriceSnapshot" WHERE "gameId" IN (${placeholders})`,
    args: gameIds
  });
  const seqTime = performance.now() - seqStart;
  console.log(`🐢 Sequential Enrichment (3 separate RTTs): ${seqTime.toFixed(1)} ms`);

  // 2. Parallel (Promise.all - concurrent HTTP requests)
  const parStart = performance.now();
  await Promise.all([
    libsqlClient.execute({
      sql: `SELECT g."A" as "gameId", t."name", t."slug" FROM "_GameToTag" g INNER JOIN "Tag" t ON g."B" = t."id" WHERE g."A" IN (${placeholders})`,
      args: gameIds
    }),
    libsqlClient.execute({
      sql: `SELECT * FROM "PurchaseLink" WHERE "gameId" IN (${placeholders})`,
      args: gameIds
    }),
    libsqlClient.execute({
      sql: `SELECT * FROM "PriceSnapshot" WHERE "gameId" IN (${placeholders})`,
      args: gameIds
    })
  ]);
  const parTime = performance.now() - parStart;
  console.log(`⚡ Parallel Enrichment (Promise.all): ${parTime.toFixed(1)} ms`);

  // 3. Batched (libsql batch - single HTTP request)
  const batchStart = performance.now();
  const rawClient = (globalThis as any).tursoInstance?.$client;
  if (rawClient && rawClient.batch) {
    await rawClient.batch([
      {
        sql: `SELECT g."A" as "gameId", t."name", t."slug" FROM "_GameToTag" g INNER JOIN "Tag" t ON g."B" = t."id" WHERE g."A" IN (${placeholders})`,
        args: gameIds
      },
      {
        sql: `SELECT * FROM "PurchaseLink" WHERE "gameId" IN (${placeholders})`,
        args: gameIds
      },
      {
        sql: `SELECT * FROM "PriceSnapshot" WHERE "gameId" IN (${placeholders})`,
        args: gameIds
      }
    ]);
    const batchTime = performance.now() - batchStart;
    console.log(`🚀 Batched Enrichment (1 single HTTP request): ${batchTime.toFixed(1)} ms`);
  }
}

testEnrichment();
