import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Simple type definitions for Pipeline Stage
interface Stage {
  name: string;
  script: string;
  description: string;
  defaultLimit?: number;
  extraArgs?: string[];
}

const STAGES: Stage[] = [
  {
    name: "Primary Ingestion",
    script: "scripts/ingest.ts",
    description: "Ingest horror games from IGDB",
    defaultLimit: 1000
  },
  {
    name: "Itch.io Scraper",
    script: "scripts/enrich-itch.ts",
    description: "Ingest/enrich games from Itch.io",
    extraArgs: ["--batch"] // Ensure batch run to avoid interactive prompt
  },
  {
    name: "Mood Tagging",
    script: "scripts/tag-moods.ts",
    description: "Zero-Shot AI mood classification",
    defaultLimit: 50
  },
  {
    name: "Metadata Enrichment",
    script: "scripts/enrich.ts",
    description: "Enrich details from RAWG & Steam",
    defaultLimit: 100
  },
  {
    name: "Scare Rating Scoring",
    script: "scripts/enrich-scare.ts",
    description: "Evaluate scare ratings using Gemini API & Steam reviews",
    defaultLimit: 20
  },
  {
    name: "Price Sync",
    script: "scripts/sync-prices.ts",
    description: "Warmer for CheapShark & IsThereAnyDeal prices"
  },
  {
    name: "Flag Trending",
    script: "scripts/flag-trending.ts",
    description: "Recalculate top games and flag trending statuses"
  }
];

function showHelp() {
  console.log(`
==================================================
hoGAMEGATA Orchestrated Sync Pipeline Runner
==================================================
Usage:
  npx tsx scripts/run-pipeline.ts [options]

Options:
  --sync                Pass incremental sync flag to primary ingestion (ingest.ts)
  --reset               Pass reset flag to primary ingestion (starts catalog from offset 0)
  --limit <number>      Override maximum records to process in limit-bound stages (Ingestion, Moods, Enrichment, Scare Rating)
  --stages <list>       Comma-separated list of stages to run (e.g. "Primary Ingestion,Price Sync")
  --skip <list>         Comma-separated list of stages to skip
  --help                Show this help screen
`);
}

async function runChildProcess(script: string, args: string[]): Promise<{ code: number; logs: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const child = spawn("npx", ["tsx", script, ...args], {
      env: { ...process.env, FORCE_COLOR: "1" },
      shell: isWindows
    });

    let logOutput = "";

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      logOutput += chunk;
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      logOutput += chunk;
      process.stderr.write(chunk);
    });

    child.on("close", (code) => {
      resolve({ code: code || 0, logs: logOutput });
    });
  });
}

async function main() {
  const cliArgs = process.argv.slice(2);

  if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  // Parse arguments
  const isSync = cliArgs.includes("--sync");
  const isReset = cliArgs.includes("--reset");

  let customLimit: number | null = null;
  const limitIdx = cliArgs.indexOf("--limit");
  if (limitIdx !== -1 && cliArgs[limitIdx + 1]) {
    const val = parseInt(cliArgs[limitIdx + 1], 10);
    if (!isNaN(val)) {
      customLimit = val;
    }
  }

  let filterStages: string[] | null = null;
  const stagesIdx = cliArgs.indexOf("--stages");
  if (stagesIdx !== -1 && cliArgs[stagesIdx + 1]) {
    filterStages = cliArgs[stagesIdx + 1].split(",").map(s => s.trim().toLowerCase());
  }

  let skipStages: string[] = [];
  const skipIdx = cliArgs.indexOf("--skip");
  if (skipIdx !== -1 && cliArgs[skipIdx + 1]) {
    skipStages = cliArgs[skipIdx + 1].split(",").map(s => s.trim().toLowerCase());
  }

  console.log(`==================================================`);
  console.log(`🎬 STARTING hoGAMEGATA MASTER PIPELINE`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔧 Parameters: sync=${isSync}, reset=${isReset}, limit=${customLimit ?? "default"}`);
  console.log(`==================================================\n`);

  const activeStages = STAGES.filter((stage) => {
    const lowerName = stage.name.toLowerCase();
    if (skipStages.includes(lowerName)) {
      return false;
    }
    if (filterStages) {
      return filterStages.includes(lowerName);
    }
    return true;
  });

  if (activeStages.length === 0) {
    console.log("⚠️ No active stages selected. Exiting.");
    process.exit(0);
  }

  const results: Array<{ stageName: string; status: "SUCCESS" | "FAILED" | "SKIPPED"; duration: number; errorCode?: number }> = [];
  let totalLogs = "";
  const overallStartTime = Date.now();

  for (const stage of activeStages) {
    const stageStartTime = Date.now();
    console.log(`\n--------------------------------------------------`);
    console.log(`🚀 STAGE: ${stage.name}`);
    console.log(`📖 Description: ${stage.description}`);
    console.log(`--------------------------------------------------\n`);

    // Prepare arguments for this stage
    const args: string[] = [];
    if (stage.extraArgs) {
      args.push(...stage.extraArgs);
    }

    // Pass down limit if applicable
    if (stage.defaultLimit !== undefined) {
      let limitToUse = customLimit !== null ? customLimit : stage.defaultLimit;
      // Cap CPU-heavy local NLP Mood Tagging to keep runs fast in cloud environments
      if (stage.name === "Mood Tagging") {
        limitToUse = Math.min(limitToUse, 30);
      }
      args.push("--limit", limitToUse.toString());
    }

    // Pass sync/reset to primary ingestion
    if (stage.script === "scripts/ingest.ts") {
      if (isSync) args.push("--sync");
      if (isReset) args.push("--reset");
    }

    try {
      const { code, logs } = await runChildProcess(stage.script, args);
      const duration = (Date.now() - stageStartTime) / 1000;
      totalLogs += `\n\n--- STAGE: ${stage.name} ---\n` + logs;

      if (code === 0) {
        console.log(`\n✅ ${stage.name} completed successfully in ${duration.toFixed(1)}s.`);
        results.push({ stageName: stage.name, status: "SUCCESS", duration });
      } else {
        console.log(`\n❌ ${stage.name} failed with exit code ${code} after ${duration.toFixed(1)}s.`);
        results.push({ stageName: stage.name, status: "FAILED", duration, errorCode: code });
        
        // If a critical first step fails, we might want to log a warnings but continue.
        // We will proceed for downstream tasks so partial success is preserved.
        console.log(`⚠️ Pipeline orchestrator proceeding to next stage despite failure.`);
      }
    } catch (err: any) {
      const duration = (Date.now() - stageStartTime) / 1000;
      console.error(`\n❌ ${stage.name} crashed with error:`, err);
      results.push({ stageName: stage.name, status: "FAILED", duration });
      totalLogs += `\n\n--- STAGE: ${stage.name} (CRASHED) ---\n` + String(err);
    }
  }

  const overallDuration = (Date.now() - overallStartTime) / 1000;

  // Print Summary Table
  console.log(`\n==================================================`);
  console.log(`🏁 PIPELINE RUN COMPLETED`);
  console.log(`⏱️ Total Time: ${overallDuration.toFixed(1)}s`);
  console.log(`==================================================`);
  console.log(
    String("Stage").padEnd(25) + 
    String("Status").padEnd(12) + 
    String("Duration").padEnd(10)
  );
  console.log("-".repeat(50));
  
  let failedAny = false;
  for (const r of results) {
    const colorStatus = r.status === "SUCCESS" ? "✅ SUCCESS" : "❌ FAILED";
    if (r.status === "FAILED") failedAny = true;
    console.log(
      r.stageName.padEnd(25) + 
      colorStatus.padEnd(12) + 
      `${r.duration.toFixed(1)}s`.padEnd(10)
    );
  }
  console.log(`==================================================\n`);

  // Save execution log
  const logDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  const summaryLogFile = path.join(logDir, "pipeline_runs.log");
  const historyJsonFile = path.join(logDir, "pipeline_history.json");

  // Save text logs
  const logHeader = `\n\n=== RUN COMPLETED AT ${new Date().toISOString()} (Duration: ${overallDuration.toFixed(1)}s, Success: ${!failedAny}) ===\n`;
  fs.appendFileSync(summaryLogFile, logHeader + totalLogs);

  // Save structured history
  let historyList: any[] = [];
  if (fs.existsSync(historyJsonFile)) {
    try {
      historyList = JSON.parse(fs.readFileSync(historyJsonFile, "utf-8"));
    } catch (e) {
      historyList = [];
    }
  }
  
  historyList.unshift({
    timestamp: new Date().toISOString(),
    duration: overallDuration,
    success: !failedAny,
    results: results.map(r => ({
      stageName: r.stageName,
      status: r.status,
      duration: r.duration
    }))
  });

  // Limit history to 20 entries
  if (historyList.length > 20) {
    historyList = historyList.slice(0, 20);
  }
  fs.writeFileSync(historyJsonFile, JSON.stringify(historyList, null, 2));

  process.exit(failedAny ? 1 : 0);
}

main();
