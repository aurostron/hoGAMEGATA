import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";
import type { InStatement } from "@libsql/client";

async function main() {
  console.log("\n==================================================");
  console.log("🚀 HORROR AUDIT PASS 1: COMMIT SOFT-HIDES TO TURSO");
  console.log("==================================================");

  const reportPath = path.resolve(process.cwd(), "scripts/horror-audit/data/horror_audit_pass1_report.json");
  if (!fs.existsSync(reportPath)) {
    console.error("❌ Report file missing! Run generate-report.ts first.");
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const softHides: any[] = report.approvedSoftHides || [];

  console.log(`📋 Total Non-Horror / Noise Items to Soft-Hide: ${softHides.length}`);

  if (softHides.length === 0) {
    console.log("✅ No items to hide.");
    return;
  }

  const stmts: InStatement[] = softHides.map((item) => ({
    sql: `UPDATE "Game" SET status = 'hidden', "updatedAt" = unixepoch() WHERE id = ?`,
    args: [item.id],
  }));

  console.log(`⚡ Dispatching ${stmts.length} atomic updates to TursoDB...`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await rawDb.batch(chunk, "write");
    process.stdout.write(`\r   Soft-hidden [${Math.min(i + BATCH_SIZE, stmts.length)} / ${stmts.length}] items...`);
  }

  console.log(`\n\n==================================================`);
  console.log(`🏁 COMMIT FINISHED`);
  console.log(`==================================================`);
  console.log(`Total Non-Horror Items Soft-Hidden: ${softHides.length}`);

  const countRes = await rawDb.execute(`SELECT count(*) as count FROM "Game" WHERE status IS NULL OR status != 'hidden'`);
  console.log(`🎮 Total Active Verified Games in TursoDB: ${countRes.rows[0].count}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Commit error:", err);
  process.exit(1);
});
