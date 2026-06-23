import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 60000,
  max: 10,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function generateRecommendations() {
  const startTime = Date.now();
  console.log("⚡ Starting high-performance precomputed recommendation generation...");
  
  try {
    console.log("🧹 Clearing old recommendations...");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "GameRecommendation";`);

    console.log("🚀 Running database-side pgvector LATERAL join query...");
    const resultCount = await prisma.$executeRawUnsafe(`
      INSERT INTO "GameRecommendation" ("gameId", "recommendedGameId", "distance")
      SELECT g1.id AS "gameId", g2.id AS "recommendedGameId", (g1.embedding <-> g2.embedding) AS "distance"
      FROM "Game" g1
      CROSS JOIN LATERAL (
        SELECT id, embedding
        FROM "Game"
        WHERE id != g1.id AND embedding IS NOT NULL
        ORDER BY embedding <-> g1.embedding
        LIMIT 10
      ) g2
      WHERE g1.embedding IS NOT NULL;
    `);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Success! Generated ${resultCount} recommendation pairs in ${elapsed}s.`);
  } catch (err) {
    console.error("❌ Recommendation generation query failed:", err);
  }
}

generateRecommendations()
  .catch(err => {
    console.error("❌ Recommendation generation script failed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
