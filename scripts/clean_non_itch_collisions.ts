import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  console.log("Connecting to Turso remote database...");
  const remote = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });

  console.log("Cleaning up collision pl_itch_% purchase links on non-itch games in remote Turso...");
  const delLinksRemote = await remote.execute(`
    DELETE FROM PurchaseLink 
    WHERE id LIKE 'pl_itch_%' 
      AND gameId IN (
        SELECT id FROM Game 
        WHERE slug NOT LIKE 'itch-%' 
          AND (source IS NULL OR source != 'itch')
      )
  `);
  console.log("Remote PurchaseLink rows deleted:", delLinksRemote.rowsAffected);

  console.log("Cleaning up collision ps_itch_% price snapshots on non-itch games in remote Turso...");
  const delPricesRemote = await remote.execute(`
    DELETE FROM PriceSnapshot 
    WHERE id LIKE 'ps_itch_%' 
      AND gameId IN (
        SELECT id FROM Game 
        WHERE slug NOT LIKE 'itch-%' 
          AND (source IS NULL OR source != 'itch')
      )
  `);
  console.log("Remote PriceSnapshot rows deleted:", delPricesRemote.rowsAffected);

  // Also clean local sqlite db if exists
  try {
    const local = createClient({ url: "file:data/gamegata-db.db" });
    const delLinksLocal = await local.execute(`
      DELETE FROM PurchaseLink 
      WHERE id LIKE 'pl_itch_%' 
        AND gameId IN (
          SELECT id FROM Game 
          WHERE slug NOT LIKE 'itch-%' 
            AND (source IS NULL OR source != 'itch')
        )
    `);
    console.log("Local PurchaseLink rows deleted:", delLinksLocal.rowsAffected);

    const delPricesLocal = await local.execute(`
      DELETE FROM PriceSnapshot 
      WHERE id LIKE 'ps_itch_%' 
        AND gameId IN (
          SELECT id FROM Game 
          WHERE slug NOT LIKE 'itch-%' 
            AND (source IS NULL OR source != 'itch')
        )
    `);
    console.log("Local PriceSnapshot rows deleted:", delPricesLocal.rowsAffected);
  } catch (e) {
    console.log("Local db update skipped/not found:", e);
  }

  console.log("\nVerifying 'Visage' status in Turso:");
  const visageLinks = await remote.execute(`
    SELECT pl.storeName, pl.url 
    FROM PurchaseLink pl
    JOIN Game g ON pl.gameId = g.id
    WHERE g.slug = 'visage'
  `);
  console.log("Visage Purchase Links:", visageLinks.rows);

  const visagePrices = await remote.execute(`
    SELECT ps.storeName, ps.dealPrice, ps.dealUrl 
    FROM PriceSnapshot ps
    JOIN Game g ON ps.gameId = g.id
    WHERE g.slug = 'visage'
  `);
  console.log("Visage Price Snapshots:", visagePrices.rows);
}

main().catch(console.error);
