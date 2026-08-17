import "dotenv/config";
import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";

async function exportPromoData() {
  const c = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });

  console.log("Fetching top classic & trending games...");
  const popularRes = await c.execute(`
    SELECT id, title, slug, coverUrl, developerNames, genreNames, rating, steamRating, isTrending
    FROM Game
    WHERE coverUrl IS NOT NULL 
      AND length(coverUrl) > 10
      AND (rating IS NOT NULL OR steamRating IS NOT NULL OR isTrending = 1)
      AND (status IS NULL OR status != 'hidden')
    ORDER BY isTrending DESC, rating DESC, steamRating DESC
    LIMIT 80
  `);

  console.log("Fetching top indie / itch games...");
  const itchRes = await c.execute(`
    SELECT id, title, slug, coverUrl, developerNames, genreNames, rating, steamRating, isTrending
    FROM Game
    WHERE coverUrl IS NOT NULL 
      AND length(coverUrl) > 10
      AND (slug LIKE 'itch-%' OR source = 'itch' OR source = 'itchio')
      AND (status IS NULL OR status != 'hidden')
    ORDER BY id DESC
    LIMIT 80
  `);

  const statsRes = await c.execute(`
    SELECT 
      (SELECT count(*) FROM Game) as totalGames,
      (SELECT count(*) FROM Developer) as totalDevelopers,
      (SELECT count(*) FROM Game WHERE slug LIKE 'itch-%' OR source = 'itch' OR source = 'itchio') as itchGames,
      (SELECT count(*) FROM PurchaseLink) as totalLinks,
      (SELECT count(*) FROM PriceSnapshot) as totalSnapshots
  `);

  // Combine and deduplicate
  const map = new Map<string, any>();
  for (const g of [...popularRes.rows, ...itchRes.rows]) {
    let cover = String(g.coverUrl || "");
    if (cover.includes("t_thumb")) cover = cover.replace("t_thumb", "t_cover_big");
    if (cover.includes("t_cover_small")) cover = cover.replace("t_cover_small", "t_cover_big");
    map.set(String(g.id), { ...g, coverUrl: cover });
  }

  const outputDir = path.resolve("promo");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const promoData = {
    stats: statsRes.rows[0],
    games: Array.from(map.values())
  };

  fs.writeFileSync(path.join(outputDir, "data.json"), JSON.stringify(promoData, null, 2));
  console.log(`Saved ${promoData.games.length} games and stats to ${path.join(outputDir, "data.json")}`);
}

exportPromoData().catch(console.error);
