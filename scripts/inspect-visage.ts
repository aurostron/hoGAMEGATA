import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const c = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });

  const game = await c.execute("SELECT id, title, slug, source FROM Game WHERE slug = 'visage'");
  console.log("Game:", game.rows[0]);
  if (game.rows[0]) {
    const links = await c.execute(`SELECT * FROM PurchaseLink WHERE gameId = '${game.rows[0].id}'`);
    console.log("PurchaseLinks:", links.rows);
    const prices = await c.execute(`SELECT * FROM PriceSnapshot WHERE gameId = '${game.rows[0].id}'`);
    console.log("PriceSnapshots:", prices.rows);
  }
}

main().catch(console.error);
