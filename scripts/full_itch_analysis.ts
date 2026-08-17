import { createClient } from "@libsql/client";
import * as path from "path";

async function main() {
  const dataDir = path.resolve(process.cwd(), "data");
  const itchClient = createClient({ url: `file:${path.join(dataDir, "itch-horror.db").replace(/\\/g, '/')}` });
  const gClient = createClient({ url: `file:${path.join(dataDir, "gamegata-db.db").replace(/\\/g, '/')}` });

  console.log("Analyzing full 98k itch dataset against Gamegata DB...");
  const allGamegataGames = await gClient.execute(`SELECT id, title, slug FROM "Game"`);
  const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // Index existing Gamegata games by normalized title AND by existing itch URLs
  const titleMap = new Map<string, { id: string, slug: string }>();
  for (const g of allGamegataGames.rows) {
    const norm = normalize(String(g.title));
    if (norm) {
      titleMap.set(norm, { id: String(g.id), slug: String(g.slug) });
    }
  }

  const existingItchLinks = await gClient.execute(`SELECT gameId, url FROM "PurchaseLink" WHERE storeName = 'itch.io' OR url LIKE '%itch.io%'`);
  const urlMap = new Map<string, string>();
  for (const l of existingItchLinks.rows) {
    if (l.url) urlMap.set(String(l.url).toLowerCase().trim().replace(/\/$/, ''), String(l.gameId));
  }

  // Load all 97,995 itch games
  const allItch = await itchClient.execute(`SELECT url, title, author, author_url, stars, ratings, price, desc, tags, cover, ai_no_ai FROM games`);
  console.log(`Loaded ${allItch.rows.length} itch games.`);

  let matchByUrl = 0;
  let matchByTitle = 0;
  let newGamesWithCover = 0;
  let newGamesWithoutCover = 0;
  let totalWithRatings = 0;
  let uniqueAuthors = new Set<string>();
  let allTagsSet = new Set<string>();

  const slugSet = new Set<string>();
  for (const g of allGamegataGames.rows) {
    slugSet.add(String(g.slug).toLowerCase());
  }

  let slugCollisions = 0;

  for (const row of allItch.rows) {
    const url = String(row.url || '').toLowerCase().trim().replace(/\/$/, '');
    const title = String(row.title || '').trim();
    const norm = normalize(title);
    const hasCover = !!(row.cover && String(row.cover).trim() !== '');

    if (row.author) uniqueAuthors.add(String(row.author).trim());
    if (row.stars && Number(row.stars) > 0) totalWithRatings++;

    if (row.tags) {
      try {
        const parsed = JSON.parse(String(row.tags));
        if (Array.isArray(parsed)) {
          parsed.forEach((t: string) => allTagsSet.add(t.trim()));
        }
      } catch {}
    }

    if (urlMap.has(url)) {
      matchByUrl++;
    } else if (titleMap.has(norm)) {
      matchByTitle++;
    } else {
      if (hasCover) {
        newGamesWithCover++;
      } else {
        newGamesWithoutCover++;
      }
    }
  }

  console.log("=== FULL ANALYSIS RESULTS ===");
  console.log(`Total Itch Games: ${allItch.rows.length}`);
  console.log(`Already matched by Itch URL in Gamegata: ${matchByUrl}`);
  console.log(`Matched existing Gamegata games by Title: ${matchByTitle}`);
  console.log(`Total Existing Games to be linked with itch.io: ${matchByUrl + matchByTitle}`);
  console.log(`New Unique Itch Games WITH cover: ${newGamesWithCover}`);
  console.log(`New Unique Itch Games WITHOUT cover: ${newGamesWithoutCover}`);
  console.log(`Total New Unique Itch Games: ${newGamesWithCover + newGamesWithoutCover}`);
  console.log(`Unique Itch Authors: ${uniqueAuthors.size}`);
  console.log(`Unique Itch Tags found: ${allTagsSet.size}`);
  console.log(`Games with Star/Rating info: ${totalWithRatings}`);
}

main().catch(console.error);
