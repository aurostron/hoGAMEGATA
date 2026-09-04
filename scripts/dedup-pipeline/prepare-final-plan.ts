import * as fs from "fs";
import * as path from "path";

async function main() {
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pipeline/data");
  const poolA = JSON.parse(fs.readFileSync(path.join(dataDir, "classified_pool_a.json"), "utf-8"));
  const verdicts = JSON.parse(fs.readFileSync(path.join(dataDir, "gemini_verdicts.json"), "utf-8"));

  const backupsDir = path.resolve(process.cwd(), "backups");
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("dedup_snapshot_") && f.endsWith(".json")).sort().reverse();
  const snapshot = JSON.parse(fs.readFileSync(path.join(backupsDir, files[0]), "utf-8"));

  const gamesBySlug = new Map<string, any>();
  for (const g of snapshot.games) {
    gamesBySlug.set(g.slug, g);
  }

  const finalMerges: Array<{ primary: any; secondaries: any[]; reason: string; source: string }> = [];

  // Add Pool A
  for (const item of poolA) {
    finalMerges.push({
      primary: item.primary,
      secondaries: item.secondaries,
      reason: item.reason,
      source: "Deterministic Pool A"
    });
  }

  // Add Gemini Approved Merges
  const approved = verdicts.filter((v: any) => v.shouldMerge && v.mergeIntoSlug);
  for (const app of approved) {
    const primary = gamesBySlug.get(app.mergeIntoSlug);
    const secondary = gamesBySlug.get(app.candidateSlug);
    if (primary && secondary) {
      finalMerges.push({
        primary,
        secondaries: [secondary],
        reason: app.reason,
        source: "Gemini 2.5 Flash Arbiter"
      });
    }
  }

  fs.writeFileSync(path.join(dataDir, "final_merges.json"), JSON.stringify(finalMerges, null, 2), "utf-8");

  const totalSecondaries = finalMerges.reduce((sum, m) => sum + m.secondaries.length, 0);

  console.log(`\n==================================================`);
  console.log(`📦 FINAL MERGE PLAN READY FOR EXECUTION`);
  console.log(`==================================================`);
  console.log(`Total Consolidation Clusters:  ${finalMerges.length}`);
  console.log(`  - Pool A (Deterministic):    ${poolA.length}`);
  console.log(`  - Gemini 2.5 Flash Arbiter:  ${approved.length}`);
  console.log(`Total Secondary Games to Hide: ${totalSecondaries}`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
