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
    const { tursoAuth, initTursoAuthForRequest } = await import("../src/lib/tursoAuth");
    initTursoAuthForRequest(process.env);
    const { systemConfig } = await import("../src/db/auth-schema");
    const { eq, sql } = await import("drizzle-orm");

    // Ensure the SystemConfig table exists in Turso Auth database
    await tursoAuth.run(sql`CREATE TABLE IF NOT EXISTS SystemConfig (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);

    const result = await tursoAuth
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "maintenance_mode"))
      .limit(1);
      
    const isMaintenance = result.length > 0 && result[0].value === "true";
    console.log(`\n==================================================`);
    console.log(`📢 CURRENT STATUS: Website is ${isMaintenance ? "🔴 OFFLINE (Maintenance Mode)" : "🟢 ONLINE (Normal)"}`);
    console.log(`==================================================\n`);
    
    const action = await askQuestion(`Toggle Maintenance Mode ${isMaintenance ? "OFF" : "ON"}? [y/N]: `);
    if (action.toLowerCase() === "y") {
      const newValue = !isMaintenance;
      
      // Upsert value in SQLite using Drizzle upsert
      await tursoAuth
        .insert(systemConfig)
        .values({ key: "maintenance_mode", value: String(newValue) })
        .onConflictDoUpdate({
          target: systemConfig.key,
          set: { value: String(newValue) }
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
  console.log("4. GOG Catalog Ingestion Control");
  console.log("5. Steam Catalog Ingestion Control");
  console.log("6. Retro / Abandonware Ingestion Control");
  console.log("7. Outbound Click Analytics Redirection (Stage 5)");
  console.log("8. Price Sync Aggregator (CheapShark / ITAD)");
  console.log("9. SQLite / Turso Search Index Status");
  console.log("10. Scare Meter NLP Batch Processing");
  console.log("11. Toggle Website Maintenance Mode");
  console.log("12. View Database Statistics");
  console.log("13. Database Duplicate Resolution Control");
  console.log("14. IGDB Data Dumps Explorer (Partner API)");
  console.log("15. Developer Page & Link Management");
  console.log("16. Exit Portal");
  console.log("==================================================");

  const choice = await askQuestion("Select category [1-16]: ");

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
      await showGogMenu();
      break;
    case "5":
      await showSteamMenu();
      break;
    case "6":
      await showRetroMenu();
      break;
    case "7":
      console.log("\n💡 Outbound Click Redirection operates automatically at runtime.");
      console.log("Redirect Endpoint: /re/[slug]/[store]");
      console.log("Clicks are logged in 'ReferralClick' database table.");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "8": {
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
    case "9": {
      console.log("\n💡 SQLite/Turso search operates automatically via Drizzle-ORM. FTS triggers are not required for Turso.");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    }
    case "10":
      await showScareMenu();
      break;
    case "11":
      await toggleMaintenanceMode();
      break;
    case "12":
      await runScript("scripts/check-game.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "13":
      await showDuplicateResolutionMenu();
      break;
    case "14":
      await showDumpsMenu();
      break;
    case "15":
      await showDeveloperMenu();
      break;
    case "16":
      console.log("👋 Exiting portal.");
      process.exit(0);
    default:
      console.log("❌ Invalid choice.");
      await sleep(1000);
  }
}

async function showDuplicateResolutionMenu() {
  console.log("\n--------------------------------------------------");
  console.log("🧬 DATABASE DUPLICATE RESOLUTION CONTROL");
  console.log("--------------------------------------------------");
  console.log("1. Scan and Auto-Merge GOG Companion Duplicates (Soundtracks, DLCs, Artbooks)");
  console.log("2. Launch standard interactive duplicate resolution engine");
  console.log("3. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-3]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/cleanup-gog-duplicates.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "2":
      await runScript("scripts/merge-duplicates.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "3":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showDuplicateResolutionMenu();
}

async function showDeveloperMenu() {
  console.log("\n--------------------------------------------------");
  console.log("👥 DEVELOPER PAGE & LINK MANAGEMENT");
  console.log("--------------------------------------------------");
  console.log("1. Run Developer Relations Sync (Connect all games to developers)");
  console.log("2. View Developer Statistics");
  console.log("3. Enrich Games with Missing Developer Metadata (from Dumps)");
  console.log("4. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-4]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/sync-missing-devs.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "2":
      await runScript("scripts/check-developers.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "3":
      await runScript("scripts/enrich-missing-devs.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "4":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showDeveloperMenu();
}

async function showDumpsMenu() {
  console.log("\n--------------------------------------------------");
  console.log("📦 IGDB DATA DUMPS EXPLORER");
  console.log("--------------------------------------------------");
  console.log("1. Check hoGAMEGATA DB vs IGDB Dump (Comparison Report)");
  console.log("2. Download / Update IGDB Data Dumps");
  console.log("3. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-3]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/compare-db-dumps.ts");
      await askQuestion("\n[Press Enter to return to main menu]");
      break;
    case "2":
      await runScript("scripts/igdb-dumps.ts");
      break;
    case "3":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showDumpsMenu();
}

async function showIngestMenu() {
  console.log("\n--------------------------------------------------");
  console.log("📥 IGDB CATALOG INGESTION");
  console.log("--------------------------------------------------");
  console.log("1. Sync modifications since last run (Incremental)");
  console.log("2. Full Ingest (Reset cursor and import from scratch)");
  console.log("3. Custom import target size (set limit)");
  console.log("4. Import a specific custom game by search/slug");
  console.log("5. Force-update existing games (Sync + Force Update)");
  console.log("6. Ingest from local Data Dumps (Daily CSVs)");
  console.log("7. Import a custom mobile game (not on IGDB)");
  console.log("8. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-8]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/ingest.ts", ["--sync"]);
      break;
    case "2":
      const confirm = await askQuestion("⚠️ Are you sure you want to reset checkpoints? [y/N]: ");
      if (confirm.toLowerCase() === "y") {
        const force = await askQuestion("Force update existing games? [y/N]: ");
        const args = ["--reset"];
        if (force.toLowerCase() === "y") args.push("--force-update");
        await runScript("scripts/ingest.ts", args);
      }
      break;
    case "3":
      const limit = await askQuestion("Enter target limit (e.g. 1000): ");
      const num = parseInt(limit, 10);
      if (!isNaN(num)) {
        const force = await askQuestion("Force update existing games? [y/N]: ");
        const args = ["--limit", num.toString()];
        if (force.toLowerCase() === "y") args.push("--force-update");
        await runScript("scripts/ingest.ts", args);
      } else {
        console.log("❌ Invalid limit.");
      }
      break;
    case "4":
      await runScript("scripts/add-custom-game.ts");
      break;
    case "5":
      await runScript("scripts/ingest.ts", ["--sync", "--force-update"]);
      break;
    case "6": {
      const dumpLimit = await askQuestion("Enter import limit (default 200): ");
      const dryRun = await askQuestion("Run as dry-run? (y/n, default n): ");
      const forceUpdate = await askQuestion("Force update existing games? (y/n, default n): ");

      const args: string[] = [];
      const parsedLimit = parseInt(dumpLimit, 10);
      if (!isNaN(parsedLimit)) {
        args.push("--limit", parsedLimit.toString());
      } else {
        args.push("--limit", "200");
      }
      if (dryRun.toLowerCase() === "y") {
        args.push("--dry-run");
      }
      if (forceUpdate.toLowerCase() === "y") {
        args.push("--force-update");
      }
      await runScript("scripts/ingest-dumps.ts", args);
      break;
    }
    case "7":
      await runScript("scripts/add-custom-mobile.ts");
      break;
    case "8":
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
  console.log("🤖 SCARE METER AI CONFIGURATION");
  console.log("--------------------------------------------------");
  console.log("1. Use Remote FreeLLM (Default)");
  console.log("2. Use Local LM Studio (Qwen2.5-3B-Instruct)");
  console.log("3. Return to Main Menu");
  console.log("--------------------------------------------------");

  const providerChoice = await askQuestion("Select provider [1-3]: ");
  if (providerChoice === "3") {
    return;
  }
  
  const providerFlags: string[] = [];
  let providerName = "Remote FreeLLM";
  if (providerChoice === "2") {
    providerFlags.push("--local");
    providerName = "Local LM Studio";
  } else if (providerChoice !== "1") {
    console.log("❌ Invalid provider choice. Defaulting to Remote FreeLLM.");
  }

  console.log(`\nUsing Engine: 👻 ${providerName} 👻`);

  console.log("\n--------------------------------------------------");
  console.log(`🤖 SCARE METER BATCH PROCESSING (${providerName})`);
  console.log("--------------------------------------------------");
  console.log("1. Run default batch (50 games)");
  console.log("2. Run large batch (500 games)");
  console.log("3. Custom batch limit (set number of games)");
  console.log("4. Process a specific game (by slug)");
  console.log("5. Process batch by tag (e.g. survival-horror)");
  console.log("6. Return to Provider Selection");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-6]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/enrich-scare.ts", providerFlags);
      break;
    case "2":
      await runScript("scripts/enrich-scare.ts", ["--limit", "500", ...providerFlags]);
      break;
    case "3":
      const limit = await askQuestion("Enter batch limit (e.g. 100): ");
      const num = parseInt(limit, 10);
      if (!isNaN(num)) {
        await runScript("scripts/enrich-scare.ts", ["--limit", num.toString(), ...providerFlags]);
      } else {
        console.log("❌ Invalid limit.");
      }
      break;
    case "4":
      const slug = await askQuestion("Enter game slug (e.g. resident-evil-4): ");
      if (slug.trim() !== "") {
        await runScript("scripts/enrich-scare.ts", ["--slug", slug.trim(), ...providerFlags]);
      } else {
        console.log("❌ Invalid slug.");
      }
      break;
    case "5":
      const tag = await askQuestion("Enter tag slug (e.g. multiplayer): ");
      const tagLimit = await askQuestion("Enter batch limit (e.g. 50): ");
      const parsedTagLimit = parseInt(tagLimit, 10);
      if (tag.trim() !== "" && !isNaN(parsedTagLimit)) {
        await runScript("scripts/enrich-scare.ts", ["--tag", tag.trim(), "--limit", parsedTagLimit.toString(), ...providerFlags]);
      } else {
        console.log("❌ Invalid tag or limit.");
      }
      break;
    case "6":
      await showScareMenu();
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
  console.log("9. Find and merge duplicate itch.io games");
  console.log("10. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-10]: ");
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
      await runScript("scripts/merge-duplicates.ts", ["--itch"]);
      break;
    case "10":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showItchMenu();
}

async function showGogMenu() {
  console.log("\n--------------------------------------------------");
  console.log("💽 GOG CATALOG INGESTION");
  console.log("--------------------------------------------------");
  console.log("1. Run Incremental Ingest (default limit 50)");
  console.log("2. Full Ingest (large limit, e.g. 500)");
  console.log("3. Custom import target size (set limit)");
  console.log("4. Fast Dry Run (limit 10, no DB writes)");
  console.log("5. Compare GOG Catalog vs Local DB");
  console.log("6. Import Missing GOG Horror Games (Auto Sync)");
  console.log("7. Force-update existing games (Update details + prices)");
  console.log("8. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-8]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/ingest-gog.ts", ["--limit", "50"]);
      break;
    case "2":
      await runScript("scripts/ingest-gog.ts", ["--limit", "500"]);
      break;
    case "3":
      const limit = await askQuestion("Enter target limit (e.g. 100): ");
      const num = parseInt(limit, 10);
      if (!isNaN(num)) {
        const force = await askQuestion("Force update existing games? [y/N]: ");
        const args = ["--limit", num.toString()];
        if (force.toLowerCase() === "y") args.push("--force-update");
        await runScript("scripts/ingest-gog.ts", args);
      } else {
        console.log("❌ Invalid limit.");
      }
      break;
    case "4":
      await runScript("scripts/ingest-gog.ts", ["--limit", "10", "--dry-run"]);
      break;
    case "5":
      await runScript("scripts/compare-gog.ts");
      break;
    case "6":
      await runScript("scripts/import-missing-gog.ts");
      break;
    case "7":
      await runScript("scripts/ingest-gog.ts", ["--limit", "100", "--force-update"]);
      break;
    case "8":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showGogMenu();
}

async function showSteamMenu() {
  console.log("\n--------------------------------------------------");
  console.log("♨️ STEAM CATALOG INGESTION");
  console.log("--------------------------------------------------");
  console.log("1. Run Incremental Ingest (default limit 50)");
  console.log("2. Full Ingest (large limit, e.g. 500)");
  console.log("3. Custom import target size (set limit)");
  console.log("4. Fast Dry Run (limit 10, no DB writes)");
  console.log("5. Force-update existing games (Update details + prices)");
  console.log("6. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-6]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/ingest-steam.ts", ["--limit", "50"]);
      break;
    case "2":
      await runScript("scripts/ingest-steam.ts", ["--limit", "500"]);
      break;
    case "3":
      const limit = await askQuestion("Enter target limit (e.g. 100): ");
      const num = parseInt(limit, 10);
      if (!isNaN(num)) {
        const force = await askQuestion("Force update existing games? [y/N]: ");
        const args = ["--limit", num.toString()];
        if (force.toLowerCase() === "y") args.push("--force-update");
        await runScript("scripts/ingest-steam.ts", args);
      } else {
        console.log("❌ Invalid limit.");
      }
      break;
    case "4":
      await runScript("scripts/ingest-steam.ts", ["--limit", "10", "--dry-run"]);
      break;
    case "5":
      await runScript("scripts/ingest-steam.ts", ["--limit", "100", "--force-update"]);
      break;
    case "6":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showSteamMenu();
}

async function showRetroMenu() {
  console.log("\n--------------------------------------------------");
  console.log("↩ RETRO / ABANDONWARE INGESTION");
  console.log("--------------------------------------------------");
  console.log("1. Ingest all collections (MS-DOS, PC Games, CD-ROMs, Classic Gaming)");
  console.log("2. Ingest MS-DOS software library only");
  console.log("3. Ingest Classic PC Games only");
  console.log("4. Ingest Classic Console Gaming only");
  console.log("5. Ingest CD-ROM Images only");
  console.log("6. Custom Ingestion (specify limit and/or specific collection)");
  console.log("7. Return to Main Menu");
  console.log("--------------------------------------------------");

  const choice = await askQuestion("Select action [1-7]: ");
  switch (choice) {
    case "1":
      await runScript("scripts/ingest.ts", ["--retro"]);
      break;
    case "2":
      await runScript("scripts/ingest.ts", ["--retro", "--collection", "softwarelibrary_msdos"]);
      break;
    case "3":
      await runScript("scripts/ingest.ts", ["--retro", "--collection", "classicpcgames"]);
      break;
    case "4":
      await runScript("scripts/ingest.ts", ["--retro", "--collection", "classicgaming"]);
      break;
    case "5":
      await runScript("scripts/ingest.ts", ["--retro", "--collection", "cdromimages"]);
      break;
    case "6": {
      const limit = await askQuestion("Enter target limit (default 200): ");
      const collection = await askQuestion("Enter specific collection identifier (press Enter for all): ");
      const args = ["--retro"];
      if (limit.trim()) {
        args.push("--limit", limit.trim());
      }
      if (collection.trim()) {
        args.push("--collection", collection.trim());
      }
      await runScript("scripts/ingest.ts", args);
      break;
    }
    case "7":
      return;
    default:
      console.log("❌ Invalid choice.");
  }
  await showRetroMenu();
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
