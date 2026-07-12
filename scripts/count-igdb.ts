import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const twitchId = process.env.TWITCH_CLIENT_ID;
const twitchSecret = process.env.TWITCH_CLIENT_SECRET;
const connectionString = process.env.DATABASE_URL;

if (!twitchId || !twitchSecret) {
  console.error("❌ Error: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET missing in .env.");
  process.exit(1);
}

async function run() {
  // 1. Authorize with Twitch
  const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`, {
    method: "POST"
  });
  
  if (!tokenResponse.ok) {
    throw new Error(`Twitch OAuth failed: ${tokenResponse.statusText}`);
  }

  const { access_token } = await tokenResponse.json() as { access_token: string };

  // 2. Fetch released count from IGDB
  const releasedQuery = `where themes = (19) & first_release_date != null & cover != null;`;
  const releasedRes = await fetch("https://api.igdb.com/v4/games/count", {
    method: "POST",
    headers: {
      "Client-ID": twitchId,
      "Authorization": `Bearer ${access_token}`,
      "Content-Type": "text/plain"
    },
    body: releasedQuery
  });
  const { count: igdbReleasedCount } = await releasedRes.json() as { count: number };

  // 3. Fetch upcoming count from IGDB
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const upcomingQuery = `where themes = (19) & first_release_date > ${currentTimestamp} & cover != null;`;
  const upcomingRes = await fetch("https://api.igdb.com/v4/games/count", {
    method: "POST",
    headers: {
      "Client-ID": twitchId,
      "Authorization": `Bearer ${access_token}`,
      "Content-Type": "text/plain"
    },
    body: upcomingQuery
  });
  const { count: igdbUpcomingCount } = await upcomingRes.json() as { count: number };

  // 4. Fetch local count from Prisma
  let localCount = 0;
  let prisma: PrismaClient | null = null;
  if (connectionString) {
    try {
      const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
      const pool = new Pool({ 
        connectionString,
        ssl: isLocal ? undefined : { rejectUnauthorized: false }
      });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });
      localCount = await prisma.game.count();
      await prisma.$disconnect();
      await pool.end();
    } catch (e) {
      console.warn("⚠️ Could not query local database:", e instanceof Error ? e.message : e);
    }
  }

  console.log("\n==================================================");
  console.log("🎮 IGDB vs Local Database Count");
  console.log("==================================================");
  console.log(`Released Horror Games on IGDB:  ${igdbReleasedCount.toLocaleString()}`);
  console.log(`Upcoming Horror Games on IGDB:  ${igdbUpcomingCount.toLocaleString()}`);
  console.log(`Total Horror Games on IGDB:     ${(igdbReleasedCount + igdbUpcomingCount).toLocaleString()}`);
  console.log("--------------------------------------------------");
  if (connectionString) {
    console.log(`Games in Local Database:        ${localCount.toLocaleString()}`);
    const remaining = (igdbReleasedCount + igdbUpcomingCount) - localCount;
    console.log(`Games yet to be imported:       ${remaining > 0 ? remaining.toLocaleString() : 0}`);
  } else {
    console.log("Local database count: N/A (DATABASE_URL not configured)");
  }
  console.log("==================================================\n");
}

run().catch(console.error);
