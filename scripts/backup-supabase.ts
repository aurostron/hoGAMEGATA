import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is missing in .env.");
  process.exit(1);
}

async function run() {
  console.log("📦 Starting Supabase data backup...");

  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const backupData: Record<string, any> = {};

    // 1. Fetch Platforms
    console.log("Reading Platforms...");
    backupData.platforms = await prisma.platform.findMany();

    // 2. Fetch Genres
    console.log("Reading Genres...");
    backupData.genres = await prisma.genre.findMany();

    // 3. Fetch Tags
    console.log("Reading Tags...");
    backupData.tags = await prisma.tag.findMany();

    // 4. Fetch Developers
    console.log("Reading Developers...");
    backupData.developers = await prisma.developer.findMany();

    // 5. Fetch Publishers
    console.log("Reading Publishers...");
    backupData.publishers = await prisma.publisher.findMany();

    // 6. Fetch Purchase Links
    console.log("Reading Purchase Links...");
    backupData.purchaseLinks = await prisma.purchaseLink.findMany();

    // 7. Fetch Price Snapshots
    console.log("Reading Price Snapshots...");
    backupData.priceSnapshots = await prisma.priceSnapshot.findMany();

    // 8. Fetch Recommendations
    console.log("Reading Game Recommendations...");
    backupData.gameRecommendations = await prisma.gameRecommendation.findMany();

    // 9. Fetch Games
    console.log("Reading Games...");
    backupData.games = await prisma.game.findMany();

    // 10. Write to local JSON file
    const backupPath = path.resolve("./supabase_backup.json");
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf8");
    console.log(`\n🎉 Backup completed successfully! Saved to: ${backupPath}`);
  } catch (error) {
    console.error("❌ Backup failed:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run().catch(console.error);
