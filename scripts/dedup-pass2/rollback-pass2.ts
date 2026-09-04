import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";

async function main() {
  console.log("\n==================================================");
  console.log("⏪ ROLLING BACK PASS 2 SOFT-HIDES");
  console.log("==================================================");

  const reportPath = path.resolve(process.cwd(), "scripts/dedup-pass2/data/pass2_dry_run_report.json");
  if (!fs.existsSync(reportPath)) {
    console.error("❌ Report file missing!");
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const poolAMerges = report.poolAMerges || [];
  const poolCMerges = report.poolCMerges || [];

  const secondarySlugs: string[] = [];
  poolAMerges.forEach((a: any) => secondarySlugs.push(...a.secondarySlugs));
  poolCMerges.forEach((c: any) => {
    if (c.shouldMerge && c.mergeSlug) secondarySlugs.push(c.mergeSlug);
  });

  console.log(`Un-hiding ${secondarySlugs.length} games...`);

  const CHUNK_SIZE = 50;
  for (let i = 0; i < secondarySlugs.length; i += CHUNK_SIZE) {
    const chunk = secondarySlugs.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    await rawDb.execute({
      sql: `UPDATE "Game" SET status = 'released', "updatedAt" = unixepoch() WHERE slug IN (${placeholders})`,
      args: chunk,
    });
  }

  console.log("✅ Rollback complete!");
}

main().catch(console.error);
