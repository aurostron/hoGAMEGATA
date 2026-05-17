import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in .env.");
  process.exit(1);
}

let prisma: PrismaClient;
if (connectionString.startsWith("prisma+postgres://")) {
  prisma = new PrismaClient({ accelerateUrl: connectionString });
} else {
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

async function runSetup() {
  console.log("📡 Enabling PostgreSQL extensions for FTS and typo-tolerance...");
  try {
    // 1. Enable pg_trgm for trigram similarity matching
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    console.log("✅ Extension 'pg_trgm' enabled successfully.");

    // 2. Enable unaccent for accent-insensitive search
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS unaccent;`);
    console.log("✅ Extension 'unaccent' enabled successfully.");

    // 3. Create GIN index for trigram title search
    console.log("🏗️ Creating GIN index for title trigram matches...");
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS game_title_trgm_idx ON "Game" USING gin (title gin_trgm_ops);
    `);
    console.log("✅ Trigram GIN index 'game_title_trgm_idx' created.");

    // 4. Create GIN index for FTS document vector search on title + summary
    console.log("🏗️ Creating GIN index for FTS search...");
    // We construct the tsvector on title and summary
    // Since title is not-nullable and summary is nullable, we use COALESCE on summary.
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS game_fts_idx ON "Game" USING gin (
        to_tsvector('english', title || ' ' || COALESCE(summary, ''))
      );
    `);
    console.log("✅ Full-text search GIN index 'game_fts_idx' created.");

    console.log("🎉 Database FTS setup completed successfully!");
  } catch (error) {
    console.error("❌ Error during SQL setup script execution:", error);
    process.exit(1);
  }
}

runSetup()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
