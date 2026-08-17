import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const c = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });

  const resLinks = await c.execute(`
    SELECT COUNT(*) as count 
    FROM PurchaseLink pl
    JOIN Game g ON pl.gameId = g.id
    WHERE pl.id LIKE 'pl_itch_%'
      AND g.slug NOT LIKE 'itch-%'
      AND (g.source IS NULL OR g.source != 'itch')
  `);
  console.log("Collision pl_itch_% links on non-itch games:", resLinks.rows[0].count);

  const resPrices = await c.execute(`
    SELECT COUNT(*) as count 
    FROM PriceSnapshot ps
    JOIN Game g ON ps.gameId = g.id
    WHERE ps.id LIKE 'ps_itch_%'
      AND g.slug NOT LIKE 'itch-%'
      AND (g.source IS NULL OR g.source != 'itch')
  `);
  console.log("Collision ps_itch_% prices on non-itch games:", resPrices.rows[0].count);
}

main().catch(console.error);
