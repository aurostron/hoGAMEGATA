import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set.");
  process.exit(1);
}

// Initialize Prisma
let prisma: PrismaClient;
if (connectionString.startsWith("prisma+postgres://")) {
  prisma = new PrismaClient({ accelerateUrl: connectionString });
} else {
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 60000,
    max: 10,
    ssl: isLocal ? undefined : { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

async function runFlagging() {
  console.log("🚀 Starting Cloudinary Trending Flag Script...");

  // 1. Reset all games to isTrending = false
  console.log("🧹 Resetting existing trending flags...");
  await prisma.game.updateMany({
    where: { isTrending: true },
    data: { isTrending: false }
  });

  // 2. Get Top 100 Games by popularity
  const topGames = await prisma.game.findMany({
    orderBy: { popularity: 'desc' },
    take: 100,
    select: { id: true, slug: true }
  });

  const topGameIds = topGames.map(g => g.id);
  console.log(`✅ Found ${topGames.length} top games to flag.`);

  // 3. Set isTrending = true for the top 100
  const result = await prisma.game.updateMany({
    where: { id: { in: topGameIds } },
    data: { isTrending: true }
  });

  console.log(`🎉 Successfully flagged ${result.count} games as trending!`);
  console.log("These games will now automatically use Cloudinary caching on the frontend.");
}

runFlagging()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
