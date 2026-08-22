import { turso, initTursoForRequest } from "../src/lib/turso";
import { games as gamesTable, purchaseLinks as purchaseLinksTable } from "../src/db/schema";
import { eq, like } from "drizzle-orm";
import * as dotenv from "dotenv";
dotenv.config();

initTursoForRequest(process.env);

async function check() {
  const games = await turso.select().from(gamesTable).where(like(gamesTable.slug, "%madison%")).limit(5);
  console.log("Found games:", games.map(g => ({ id: g.id, slug: g.slug, title: g.title })));
  if (games.length > 0) {
    const links = await turso.select().from(purchaseLinksTable).where(eq(purchaseLinksTable.gameId, games[0].id));
    console.log("Found purchase links for first game:", links);
  }
}

check().catch(console.error);
