import { createClient } from "@libsql/client";
import * as path from "path";

async function main() {
  const dataDir = path.resolve(process.cwd(), "data");
  const itchClient = createClient({ url: `file:${path.join(dataDir, "itch-horror.db").replace(/\\/g, '/')}` });
  const gClient = createClient({ url: `file:${path.join(dataDir, "gamegata-db.db").replace(/\\/g, '/')}` });

  console.log("=== 1. Existing Itch Games in Gamegata ===");
  const existingItch = await gClient.execute(`
    SELECT id, title, slug, source, rating, developerNames, coverUrl, summary, category, status 
    FROM "Game" 
    WHERE slug LIKE 'itch-%' OR source = 'itch' OR id LIKE 'itch_%'
    LIMIT 5
  `);
  console.log("Sample existing itch games in Gamegata:", JSON.stringify(existingItch.rows, null, 2));

  // Check PurchaseLinks for existing itch games
  const existingItchLinks = await gClient.execute(`
    SELECT * FROM "PurchaseLink" WHERE storeName = 'itch.io' OR url LIKE '%itch.io%' LIMIT 5
  `);
  console.log("Sample existing itch PurchaseLinks:", JSON.stringify(existingItchLinks.rows, null, 2));

  // Check Developer records for itch
  const existingDevs = await gClient.execute(`
    SELECT * FROM "Developer" LIMIT 5
  `);
  console.log("Sample Developer records:", JSON.stringify(existingDevs.rows, null, 2));

  console.log("\n=== 2. Itch DB Analysis ===");
  // Kind distribution
  const kinds = await itchClient.execute(`SELECT kind, count(*) as cnt FROM games GROUP BY kind ORDER BY cnt DESC`);
  console.log("Kind distribution:", kinds.rows);

  // Ratings distribution (how many have ratings, stars > 0, etc.)
  const ratingStats = await itchClient.execute(`
    SELECT 
      count(*) as total,
      sum(case when cover is not null and cover != '' then 1 else 0 end) as with_cover,
      sum(case when stars > 0 then 1 else 0 end) as with_stars,
      sum(case when ratings > 0 then 1 else 0 end) as with_ratings,
      sum(case when author is not null and author != '' then 1 else 0 end) as with_author,
      sum(case when tags is not null and tags != '' and tags != '[]' then 1 else 0 end) as with_tags
    FROM games
  `);
  console.log("Data completeness stats in itch-horror.db:", ratingStats.rows[0]);

  // Check price formats
  const priceSamples = await itchClient.execute(`
    SELECT price, count(*) as cnt FROM games GROUP BY price ORDER BY cnt DESC LIMIT 15
  `);
  console.log("Top price values:", priceSamples.rows);

  // Check title matching against existing Gamegata DB
  console.log("\n=== 3. Overlap Analysis with Existing 18.7k Games ===");
  const allGamegataTitles = await gClient.execute(`SELECT id, title, slug FROM "Game"`);
  console.log(`Loaded ${allGamegataTitles.rows.length} games from gamegata-db.db`);

  const titleMap = new Map<string, { id: string, slug: string }>();
  const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  for (const g of allGamegataTitles.rows) {
    const norm = normalize(String(g.title));
    if (norm) {
      titleMap.set(norm, { id: String(g.id), slug: String(g.slug) });
    }
  }

  // Sample check on itch db
  const itchGames = await itchClient.execute(`SELECT url, title, author, stars, ratings, price, cover FROM games LIMIT 20000`);
  let matchedCount = 0;
  const sampleMatches: any[] = [];

  for (const row of itchGames.rows) {
    const norm = normalize(String(row.title));
    if (titleMap.has(norm)) {
      matchedCount++;
      if (sampleMatches.length < 5) {
        sampleMatches.push({
          itchTitle: row.title,
          gamegata: titleMap.get(norm),
          url: row.url
        });
      }
    }
  }

  console.log(`In a sample of ${itchGames.rows.length} itch games:`);
  console.log(`- Matched existing Gamegata games: ${matchedCount} (${((matchedCount/itchGames.rows.length)*100).toFixed(2)}%)`);
  console.log("Sample matches:", JSON.stringify(sampleMatches, null, 2));
}

main().catch(console.error);
