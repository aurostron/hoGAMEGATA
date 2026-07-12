import { normalizeQueryForCache } from "../src/lib/searchEngine";

async function run() {
  const query = "games like Madison";
  console.log("Normalizing query...");
  try {
    const res = normalizeQueryForCache(query);
    console.log("Normalization result:", res);
  } catch (err: any) {
    console.error("Normalization error:", err);
  }
}

run().catch(console.error);
