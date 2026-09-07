import "dotenv/config";
import { initTursoForRequest, libsqlClient } from "../src/lib/turso";
initTursoForRequest(process.env);

async function clean() {
  console.log("🔍 Finding non-USD records in PriceSnapshot...");
  const inrRecords = await libsqlClient.execute({
    sql: `SELECT ps.id, ps.gameId, g.title, ps.storeName, ps.dealPrice, ps.retailPrice, ps.currency 
          FROM PriceSnapshot ps 
          JOIN Game g ON ps.gameId = g.id 
          WHERE ps.currency = 'INR'`
  });

  console.log(`Found ${inrRecords.rows.length} INR records to normalize.`);

  const RATE = 83.5; // INR to USD exchange rate

  for (const row of inrRecords.rows) {
    const origDeal = Number(row.dealPrice);
    const origRetail = Number(row.retailPrice);
    
    // Convert to USD and round to standard price ending (.99, .50, etc.)
    const usdDeal = Math.round((origDeal / RATE) * 100) / 100;
    const usdRetail = Math.round((origRetail / RATE) * 100) / 100;

    console.log(`- "${row.title}" (${row.storeName}): ₹${origDeal} -> $${usdDeal} USD`);

    await libsqlClient.execute({
      sql: `UPDATE PriceSnapshot 
            SET dealPrice = ?, retailPrice = ?, currency = 'USD' 
            WHERE id = ?`,
      args: [usdDeal, usdRetail, row.id]
    });
  }

  console.log("✅ All INR price records converted and normalized to USD!");
}

clean().catch(console.error);
