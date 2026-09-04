import * as fs from "fs";
import * as path from "path";

function main() {
  const dataDir = path.resolve(process.cwd(), "scripts/horror-audit/data");
  const tier2: any[] = JSON.parse(fs.readFileSync(path.join(dataDir, "tier2_noise.json"), "utf-8"));
  const tier3: any[] = JSON.parse(fs.readFileSync(path.join(dataDir, "tier3_ambiguous.json"), "utf-8"));

  // Combine and deduplicate
  const map = new Map<string, any>();
  tier2.forEach((item) => map.set(item.id, { ...item, sourceFlag: "keyword-flagged" }));
  tier3.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, { ...item, sourceFlag: "genre-or-metadata-flagged" });
    }
  });

  const combined = Array.from(map.values());
  const outPath = path.join(dataDir, "arb_candidates.json");
  fs.writeFileSync(outPath, JSON.stringify(combined, null, 2), "utf-8");

  console.log(`\n==================================================`);
  console.log(`📋 PREPARED AI ARBITRATION POOL`);
  console.log(`==================================================`);
  console.log(`Keyword Flagged (Tier 2):  ${tier2.length}`);
  console.log(`Metadata Flagged (Tier 3): ${tier3.length}`);
  console.log(`Total Candidates for AI:   ${combined.length}`);
  console.log(`Saved to:                  ${outPath}`);
  console.log(`==================================================\n`);
}

main();
