import "./load-env";
import { initTursoForRequest } from "../src/lib/turso";
import { turso } from "../src/lib/turso";
import { games, purchaseLinks, priceSnapshots } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { fetchSteamDirect, fetchGogDirect, lazyGetPrices } from "../src/lib/priceEngine";

async function main() {
  initTursoForRequest(process.env);

  console.log("=== INSPECTING VISAGE GAME RECORD ===");
  const [visage] = await turso.select().from(games).where(eq(games.slug, "visage")).limit(1);
  if (!visage) {
    console.error("Visage game record not found in DB!");
    return;
  }
  console.log("Game ID:", visage.id);
  console.log("Game Title:", visage.title);

  console.log("\n=== INSPECTING VISAGE PURCHASE LINKS ===");
  const links = await turso.select().from(purchaseLinks).where(eq(purchaseLinks.gameId, visage.id));
  console.log(JSON.stringify(links, null, 2));

  console.log("\n=== INSPECTING VISAGE PRICE SNAPSHOTS ===");
  const snapshots = await turso.select().from(priceSnapshots).where(eq(priceSnapshots.gameId, visage.id));
  console.log(JSON.stringify(snapshots, null, 2));

  console.log("\n=== QUERYING DIRECT FETCHERS FOR VISAGE ===");
  const steamLink = links.find(l => l.storeName.toLowerCase() === "steam");
  const gogLink = links.find(l => l.storeName.toLowerCase() === "gog");

  if (steamLink) {
    const steamMatch = steamLink.url.match(/store\.steampowered\.com\/app\/(\d+)/i);
    const steamAppId = steamMatch ? steamMatch[1] : null;
    console.log(`Steam App ID: ${steamAppId}`);
    const steamDeals = await fetchSteamDirect(steamAppId, visage.title, visage.id);
    console.log("Steam direct results:", JSON.stringify(steamDeals, null, 2));
  }

  if (gogLink) {
    console.log(`GOG URL: ${gogLink.url}`);
    const gogDeals = await fetchGogDirect(visage.title, gogLink.url, visage.id);
    console.log("GOG direct results:", JSON.stringify(gogDeals, null, 2));
  }
}

main().catch(console.error);
