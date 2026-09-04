import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";

async function main() {
  console.log("\n==================================================");
  console.log("⏪ ROLLING BACK HORROR AUDIT PASS 1 SOFT-HIDES");
  console.log("==================================================");

  const reportPath = path.resolve(process.cwd(), "scripts/horror-audit/data/horror_audit_pass1_report.json");
  if (!fs.existsSync(reportPath)) {
    console.error("❌ Report file missing!");
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const softHides: any[] = report.approvedSoftHides || [];

  console.log(`Restoring ${softHides.length} games to 'released'...`);

  const CHUNK_SIZE = 50;
  for (let i = 0; i < softHides.length; i += CHUNK_SIZE) {
    const chunk = softHides.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    const ids = chunk.map((c) => c.id);
    await rawDb.execute({
      sql: `UPDATE "Game" SET status = 'released', "updatedAt" = unixepoch() WHERE id IN (${placeholders})`,
      args: ids,
    });
  }

  console.log("✅ Rollback complete! All games restored to 'released'.");
}

main().catch(console.error);
