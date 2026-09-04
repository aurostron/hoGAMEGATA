import "../load-env";
import * as fs from "fs";
import * as path from "path";

interface ArbResult {
  id: string;
  title: string;
  isHorror: boolean;
  classification: "pure-horror" | "horror-adjacent" | "non-horror";
  reason: string;
}

function main() {
  console.log("\n================================================================================");
  console.log("📊 HORROR INTEGRITY AUDIT: PASS 1 DRY-RUN AUDIT REPORT");
  console.log("================================================================================");

  const dataDir = path.resolve(process.cwd(), "scripts/horror-audit/data");
  const arbPath = path.join(dataDir, "gemini_arbiter_results.json");

  if (!fs.existsSync(arbPath)) {
    console.error("❌ gemini_arbiter_results.json missing! Wait for arbiter to finish.");
    process.exit(1);
  }

  const results: ArbResult[] = JSON.parse(fs.readFileSync(arbPath, "utf-8"));
  const TOTAL_GAMES = 107567;
  const CORE_HORROR_COUNT = 106975;

  const keptGames = results.filter((r) => r.isHorror);
  const pureHorror = results.filter((r) => r.classification === "pure-horror");
  const horrorAdjacent = results.filter((r) => r.classification === "horror-adjacent");
  const nonHorror = results.filter((r) => !r.isHorror);

  console.log(`\n### 1. SUMMARY METRICS`);
  console.log(`  Total Active Catalog Scanned:            ${TOTAL_GAMES}`);
  console.log(`  🛡️ Tier 1 Core Horror (Auto-Protected):  ${CORE_HORROR_COUNT} (${((CORE_HORROR_COUNT / TOTAL_GAMES) * 100).toFixed(2)}%)`);
  console.log(`  🤖 AI Arbitrated Candidates:             ${results.length}`);
  console.log(`     - 🟢 Confirmed Pure Horror:           ${pureHorror.length}`);
  console.log(`     - 🟣 Confirmed Horror-Adjacent:       ${horrorAdjacent.length}`);
  console.log(`     - 🗑️ Confirmed Non-Horror / Noise:    ${nonHorror.length}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`  🎮 Total Horror Catalog (Kept):          ${CORE_HORROR_COUNT + keptGames.length} (${(((CORE_HORROR_COUNT + keptGames.length) / TOTAL_GAMES) * 100).toFixed(2)}%)`);
  console.log(`  🙈 Proposed Non-Horror to Soft-Hide:     ${nonHorror.length} (${((nonHorror.length / TOTAL_GAMES) * 100).toFixed(2)}%)`);

  console.log(`\n### 2. SPOTLIGHT: KEY PROTECTIONS (HORROR-ADJACENT & SINISTER TWISTS KEPT)`);
  keptGames.slice(0, 15).forEach((g, idx) => {
    console.log(`  [KEEP-${String(idx + 1).padStart(2, "0")}] "${g.title}" [${g.classification.toUpperCase()}]`);
    console.log(`       Reason: ${g.reason}\n`);
  });

  console.log(`### 3. SPOTLIGHT: CONFIRMED NON-HORROR NOISE TO SOFT-HIDE`);
  nonHorror.slice(0, 20).forEach((g, idx) => {
    console.log(`  [HIDE-${String(idx + 1).padStart(2, "0")}] "${g.title}"`);
    console.log(`       Reason: ${g.reason}\n`);
  });

  // Save report JSON
  const report = {
    generatedAt: new Date().toISOString(),
    metrics: {
      totalGames: TOTAL_GAMES,
      coreHorrorProtected: CORE_HORROR_COUNT,
      aiEvaluated: results.length,
      aiConfirmedHorror: keptGames.length,
      aiPureHorror: pureHorror.length,
      aiHorrorAdjacent: horrorAdjacent.length,
      aiConfirmedNonHorror: nonHorror.length,
      totalKept: CORE_HORROR_COUNT + keptGames.length,
      proposedSoftHide: nonHorror.length,
    },
    approvedSoftHides: nonHorror,
    approvedKeeps: keptGames,
  };

  const reportPath = path.join(dataDir, "horror_audit_pass1_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`================================================================================`);
  console.log(`📁 Detailed Pass 1 report written to: ${reportPath}`);
  console.log(`================================================================================\n`);
}

main();
