import * as dotenv from "dotenv";
dotenv.config();
import { db } from "../src/lib/db";

import { getSupabaseServer } from "../src/lib/supabaseServer";

async function main() {
  console.log("Fetching games...");
  const gamesWithScreenshots = await db.game.findMany({
    where: {
      screenshots: {
        isEmpty: false
      }
    },
    take: 10,
    select: {
      id: true,
      title: true,
      screenshots: true
    }
  });

  console.log(`Found ${gamesWithScreenshots.length} games with screenshots.`);
  for (const g of gamesWithScreenshots) {
    console.log(`- ${g.title}: ${g.screenshots.length} screenshots, first: ${g.screenshots[0]}`);
  }
}

main().catch(console.error);
