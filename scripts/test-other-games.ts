import "./load-env";
import { initTursoForRequest } from "../src/lib/turso";
import { fetchGogDirect } from "../src/lib/priceEngine";

async function main() {
  initTursoForRequest(process.env);
  console.log("=== TESTING SUNDERED ===");
  const sunderedDeals = await fetchGogDirect("Sundered: Eldritch Edition", "https://www.gog.com/game/sundered", "dummy-sundered");
  console.log("Sundered GOG direct deals:", JSON.stringify(sunderedDeals, null, 2));

  console.log("\n=== TESTING PRODEUS ===");
  const prodeusDeals = await fetchGogDirect("Prodeus", "https://www.gog.com/game/prodeus", "dummy-prodeus");
  console.log("Prodeus GOG direct deals:", JSON.stringify(prodeusDeals, null, 2));
}
main().catch(console.error);
