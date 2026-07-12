import "./load-env";
import { initTursoForRequest } from "../src/lib/turso";
import { turso } from "../src/lib/turso";
import { games, purchaseLinks } from "../src/db/schema";
import { eq, and, like } from "drizzle-orm";

async function main() {
  initTursoForRequest(process.env);

  console.log("Searching for a game in DB with both Steam and GOG links...");
  const rows = await turso
    .select({
      id: games.id,
      title: games.title,
      slug: games.slug,
      storeName: purchaseLinks.storeName,
      url: purchaseLinks.url
    })
    .from(games)
    .innerJoin(purchaseLinks, eq(games.id, purchaseLinks.gameId))
    .where(eq(purchaseLinks.storeName, "GOG"))
    .limit(10);

  console.log("Games with GOG links:");
  for (const r of rows) {
    // Check if it also has a Steam link
    const otherLinks = await turso
      .select()
      .from(purchaseLinks)
      .where(and(eq(purchaseLinks.gameId, r.id), eq(purchaseLinks.storeName, "Steam")));
    
    if (otherLinks.length > 0) {
      console.log(`- Game: "${r.title}" (slug: ${r.slug})`);
      console.log(`  GOG Link: ${r.url}`);
      console.log(`  Steam Link: ${otherLinks[0].url}`);
    }
  }
}

main().catch(console.error);
