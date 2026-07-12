import "./load-env";
import { initTursoForRequest } from "../src/lib/turso";
import { lazyGetPrices } from "../src/lib/priceEngine";

async function main() {
  initTursoForRequest(process.env);
  console.log("=== TESTING REGIONAL DEALS IN INDIA (IN) ===");
  const gameId = "dummy-prodeus"; // Prodeus
  const title = "Prodeus";
  const purchaseLinks = [
    { storeName: "Steam", url: "https://store.steampowered.com/app/964800/" },
    { storeName: "GOG", url: "https://www.gog.com/game/prodeus" }
  ];

  console.log("Fetching direct deals...");
  const deals = await lazyGetPrices(gameId, title, purchaseLinks, "IN", true, "direct");
  console.log("India direct deals:", JSON.stringify(deals, null, 2));
}
main().catch(console.error);
