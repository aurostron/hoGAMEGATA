import "./load-env";
import { turso, schema, eq, count, or } from "./db-helper";

async function main() {
  console.log(`📡 Fetching official GOG catalog metadata...`);
  
  const gogUrl = 'https://catalog.gog.com/v1/catalog?limit=1&page=1&tags=horror&cc=US&lang=en';
  
  let gogCatalogCount = 0;
  try {
    const res = await fetch(gogUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const data = await res.json() as any;
      gogCatalogCount = data?.productCount || 0;
    } else {
      console.warn(`⚠️ GOG Catalog API returned status: ${res.status}`);
    }
  } catch (err) {
    console.error("❌ Failed to fetch from GOG Catalog API:", err);
  }

  console.log(`💾 Fetching local database statistics...`);
  
  let localGogCount = 0;
  try {
    const [result] = await turso
      .select({ count: count() })
      .from(schema.purchaseLinks)
      .where(
        or(
          eq(schema.purchaseLinks.storeName, "GOG"),
          eq(schema.purchaseLinks.storeName, "gog")
        )
      );
    localGogCount = result?.count || 0;
  } catch (dbErr) {
    console.error("❌ Failed to query Turso database:", dbErr);
  }

  const missing = gogCatalogCount - localGogCount;
  const coverage = gogCatalogCount > 0 ? (localGogCount / gogCatalogCount) * 100 : 0;

  console.log(`\n==================================================`);
  console.log(`📊 GOG CATALOG VS LOCAL DATABASE COMPARISON`);
  console.log(`==================================================`);
  console.log(`🌐 GOG Catalog Horror Games:   ${gogCatalogCount.toLocaleString()}`);
  console.log(`💾 Local Database GOG Games:   ${localGogCount.toLocaleString()}`);
  console.log(`⚠️ Missing GOG Horror Games:   ${missing > 0 ? missing.toLocaleString() : 0}`);
  console.log(`📈 Database Catalog Coverage:  ${coverage.toFixed(2)}%`);
  console.log(`==================================================\n`);
}

main().catch(console.error);
