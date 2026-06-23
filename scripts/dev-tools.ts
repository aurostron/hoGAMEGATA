import * as readline from "readline";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Simple env loader to ensure DATABASE_URL is available
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
}
loadEnv();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function runScript(scriptPath: string, args: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    console.log(`\n==================================================`);
    console.log(`🚀 RUNNING: npx tsx ${scriptPath} ${args.join(" ")}`);
    console.log(`==================================================\n`);
    
    const isWindows = process.platform === "win32";
    const child = spawn("npx", ["tsx", scriptPath, ...args], {
      stdio: "inherit",
      shell: isWindows,
    });
    
    child.on("close", (code) => {
      console.log(`\n==================================================`);
      console.log(`🏁 COMPLETED: Exit Code ${code}`);
      console.log(`==================================================`);
      resolve(code || 0);
    });
  });
}

async function toggleMaintenanceMode() {
  console.log("\nChecking maintenance mode status...");
  try {
    const { db } = await import("../src/lib/db");
    
    let config = await db.systemConfig.findUnique({
      where: { key: "maintenance_mode" }
    });
    
    const isMaintenance = config?.value === "true";
    console.log(`\n==================================================`);
    console.log(`📢 CURRENT STATUS: Website is ${isMaintenance ? "🔴 OFFLINE (Maintenance Mode)" : "🟢 ONLINE (Normal)"}`);
    console.log(`==================================================\n`);
    
    const action = await askQuestion(`Toggle Maintenance Mode ${isMaintenance ? "OFF" : "ON"}? [y/N]: `);
    if (action.toLowerCase() === "y") {
      const newValue = !isMaintenance;
      await db.systemConfig.upsert({
        where: { key: "maintenance_mode" },
        update: { value: String(newValue) },
        create: { key: "maintenance_mode", value: String(newValue) }
      });
      console.log(`\n✅ Maintenance mode successfully set to ${newValue ? "🔴 ON" : "🟢 OFF"}.`);
    } else {
      console.log("\n❌ Action cancelled.");
    }
  } catch (e) {
    console.error("❌ Failed to query/update database:", e);
  }
  await askQuestion("\n[Press Enter to return to main menu]");
}

async function showMainMenu() {
  console.log("\n==================================================");
  console.log("🖥️  hoGAMEGATA UNIFIED DEVELOPER PORTAL");
  console.log("==================================================");
  console.log("1. IGDB Catalog Ingestion Control");
  console.log("2. RAWG & Steam Metadata Enrichment");
  console.log("3. Itch.io Scraper & Ingest Console");
  console.log("4. Outbound Click Analytics Redirection (Stage 5)");
  console.log("5. Price Sync Aggregator (CheapShark / ITAD)");
  console.log("6. PostgreSQL Search Indexes Setup (FTS)");
  console.log("7. Scare Meter NLP Batch Processing");
  console.log("8. Toggle Website Maintenance Mode");
  console.log("9. Exit Portal");
  console.log("==================================================");

  const choice = await askQuestion("Select category [1-9]: ");

  switch (choice) {
    case "1":
      await showIngestMenu();
      break;
    case "2":
      await showEnrichMenu();
      break;
    case "3":
      await showItchMenu();
      break;
    case "4":
      console.log("\n💡 Outbound Click Redirection operates automatically at runtime.");
      console.log("Redirect Endpoint: /re/[slug]/[store]");
      console.log("Clicks are logged in 'ReferralClick' database table.");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "5": {
      console.log("\n--------------------------------------------------");
      console.log("💰 PRICE SYNC AGGREGATOR");
      console.log("--------------------------------------------------");
      console.log("1. Sync top 100 games (Default)");
      console.log("2. Sync top 150 games");
      console.log("3. Sync custom number of games");
      console.log("4. Return to Main Menu");
      console.log("--------------------------------------------------");
      const priceChoice = await askQuestion("Select action [1-4]: ");
      if (priceChoice === "1") {
        await runScript("scripts/sync-prices.ts", ["--limit", "100"]);
      } else if (priceChoice === "2") {
        await runScript("scripts/sync-prices.ts", ["--limit", "150"]);
      } else if (priceChoice === "3") {
        const customLimit = await askQuestion("Enter target limit: ");
        const num = parseInt(customLimit, 10);
        if (!isNaN(num)) {
          await runScript("scripts/sync-prices.ts", ["--limit", num.toString()]);
        } else {
          console.log("❌ Invalid limit.");
        }
      }
      if (priceChoice !== "4") {
        await askQuestion("\n[Press Enter to return to main menu]");
      }
      break;
    }
    case "6": {
      console.log("\nRunning FTS Database Index Setup...");
      await runScript("scripts/setup_fts.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    }
    case "7":
      await showScareMenu();
      break;
    case "8":
      await toggleMaintenanceMode();
      break;
    case "9":
      console.log("👋 Exiting portal.");
      process.exit(0);
    default:
      console.log("❌ Invalid choice.");
      await sleep(1000);
  }
}

async function showIngestMenu() {
  console.log("\n--------------------------------------------------");
  console.log("📥 IGDB CATALOG INGESTION");
  console.log("--------------------------------------------------");
  console.log("1. Sync modifications since last run (Incremental)");
  console.log("2. Full Ingest (Reset cursor and import from scratch)");
  console.log("3. Custom import target size (set limit)");
  console.log("4. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-4]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/ingest.ts", ["--sync"]);
      break;
    case "2":
      const confirm = await askQuestion("⚠️ Are you sure you want to reset checkpoints? [y/N]: ");
      if (confirm.toLowerCase() === "y") {
        await runScript("scripts/ingest.ts", ["--reset"]);
      }
      break;
    case "3":
      const limit = await askQuestion("Enter target limit (e.g. 1000): ");
      const num = parseInt(limit, 10);
      if (!isNaN(num)) {
        await runScript("scripts/ingest.ts", ["--limit", num.toString()]);
      } else {
        console.log("❌ Invalid limit.");
      }
      break;
    case "4":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showIngestMenu();
}

async function showEnrichMenu() {
  console.log("\n--------------------------------------------------");
  console.log("⚡ RAWG & STEAM METADATA ENRICHMENT");
  console.log("--------------------------------------------------");
  console.log("1. Run batch enrichment (stale / unenriched games)");
  console.log("2. Custom batch limit (set number of games)");
  console.log("3. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-3]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/enrich.ts");
      break;
    case "2":
      const limit = await askQuestion("Enter batch limit (default 100): ");
      const num = parseInt(limit, 10);
      if (!isNaN(num)) {
        await runScript("scripts/enrich.ts", ["--limit", num.toString()]);
      } else {
        console.log("❌ Invalid limit.");
      }
      break;
    case "3":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showEnrichMenu();
}

async function showScareMenu() {
  console.log("\n--------------------------------------------------");
  console.log("🤖 SCARE METER CLOUD AI (FREELLM + GEMINI FALLBACK)");
  console.log("--------------------------------------------------");
  console.log("1. Run default batch (50 games)");
  console.log("2. Run large batch (500 games)");
  console.log("3. Custom batch limit (set number of games)");
  console.log("4. Process a specific game (by slug)");
  console.log("5. Process batch by tag (e.g. survival-horror)");
  console.log("6. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-6]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/enrich-scare.ts");
      break;
    case "2":
      await runScript("scripts/enrich-scare.ts", ["--limit", "500"]);
      break;
    case "3":
      const limit = await askQuestion("Enter batch limit (e.g. 100): ");
      const num = parseInt(limit, 10);
      if (!isNaN(num)) {
        await runScript("scripts/enrich-scare.ts", ["--limit", num.toString()]);
      } else {
        console.log("❌ Invalid limit.");
      }
      break;
    case "4":
      const slug = await askQuestion("Enter game slug (e.g. resident-evil-4): ");
      if (slug.trim() !== "") {
        await runScript("scripts/enrich-scare.ts", ["--slug", slug.trim()]);
      } else {
        console.log("❌ Invalid slug.");
      }
      break;
    case "5":
      const tag = await askQuestion("Enter tag slug (e.g. multiplayer): ");
      const tagLimit = await askQuestion("Enter batch limit (e.g. 50): ");
      const parsedTagLimit = parseInt(tagLimit, 10);
      if (tag.trim() !== "" && !isNaN(parsedTagLimit)) {
        await runScript("scripts/enrich-scare.ts", ["--tag", tag.trim(), "--limit", parsedTagLimit.toString()]);
      } else {
        console.log("❌ Invalid tag or limit.");
      }
      break;
    case "6":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showScareMenu();
}


async function showItchMenu() {
  console.log("\n--------------------------------------------------");
  console.log("🎮 ITCH.IO SCRAPER & INGESTION");
  console.log("--------------------------------------------------");
  console.log("1. Open interactive itch.io dashboard");
  console.log("2. Run batch enrichment of all unenriched itch games");
  console.log("3. Import games from 3D Horror listing (Popular) - FULL SCRAPE");
  console.log("4. Import games from 3D Horror listing (Popular) - FAST DRY RUN");
  console.log("5. Import games from 3D Horror listing (New & Popular) - FULL SCRAPE");
  console.log("6. Import games from 3D Horror listing (New & Popular) - FAST DRY RUN");
  console.log("7. Import games from 3D Horror listing (Top Rated) - FULL SCRAPE");
  console.log("8. Import games from 3D Horror listing (Top Rated) - FAST DRY RUN");
  console.log("9. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-9]: ");
  switch (choice) {
    case "1":
      // Running enrich-itch.ts without args launches its own interactive menu!
      await runScript("scripts/enrich-itch.ts");
      break;
    case "2":
      await runScript("scripts/enrich-itch.ts", ["--batch"]);
      break;
    case "3":
      await runScript("scripts/enrich-itch.ts", ["--list-url", "https://itch.io/games/tag-3d/tag-horror"]);
      break;
    case "4":
      await runScript("scripts/enrich-itch.ts", ["--list-url", "https://itch.io/games/tag-3d/tag-horror", "--dry-run"]);
      break;
    case "5":
      await runScript("scripts/enrich-itch.ts", ["--list-url", "https://itch.io/games/new-and-popular/tag-3d/tag-horror"]);
      break;
    case "6":
      await runScript("scripts/enrich-itch.ts", ["--list-url", "https://itch.io/games/new-and-popular/tag-3d/tag-horror", "--dry-run"]);
      break;
    case "7":
      await runScript("scripts/enrich-itch.ts", ["--list-url", "https://itch.io/games/top-rated/tag-3d/tag-horror"]);
      break;
    case "8":
      await runScript("scripts/enrich-itch.ts", ["--list-url", "https://itch.io/games/top-rated/tag-3d/tag-horror", "--dry-run"]);
      break;
    case "9":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showItchMenu();
}

async function main() {
  while (true) {
    await showMainMenu();
  }
}

main().catch((err) => {
  console.error("Fatal Portal Error:", err);
  process.exit(1);
});
