import "dotenv/config";
import { localRelevanceSearch } from "../src/lib/searchEngine";

async function runTests() {
  const testQueries = [
    "silent 2",
    "puppet combo",
    "visage",
    "resident",
    "ps1 retro",
    "alien horror",
    "zombie survival",
  ];

  console.log("🔍 Running Multi-Token Relevance Search Tests...\n");

  for (const q of testQueries) {
    const start = Date.now();
    const results = await localRelevanceSearch(q, 5);
    const elapsed = Date.now() - start;
    console.log(`🔎 Query: "${q}" (${results.length} results in ${elapsed}ms):`);
    results.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${r.title} | Dev: ${r.developerNames || "N/A"} | Rating: ${r.rating || "N/A"}`);
    });
    console.log("");
  }
}

runTests().catch(console.error);
