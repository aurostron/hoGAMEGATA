import "./load-env";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { turso, schema, eq, sql } from "./db-helper";

// --- CSV Processing Helpers ---
function getLatestCsv(suffix: string): string | null {
  const dir = path.join(process.cwd(), "scripts", "igdb-dumps");
  if (!fs.existsSync(dir)) return null;
  
  const suffixWithoutUnderscore = suffix.startsWith("_") ? suffix.slice(1) : suffix;
  const files = fs.readdirSync(dir).filter(f => {
    const underscoreIndex = f.indexOf("_");
    if (underscoreIndex === -1) return false;
    const nameWithoutTimestamp = f.slice(underscoreIndex + 1);
    return nameWithoutTimestamp === suffixWithoutUnderscore;
  });
  
  if (files.length === 0) return null;
  files.sort((a, b) => b.localeCompare(a));
  return path.join(dir, files[0]);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function buildHeaderIndexMap(headerLine: string): Map<string, number> {
  const headers = parseCsvLine(headerLine);
  const indexMap = new Map<string, number>();
  headers.forEach((h, idx) => indexMap.set(h.trim(), idx));
  return indexMap;
}

async function streamCsv(filePath: string, onRow: (getField: (name: string) => string) => void) {
  const fileStream = fs.createReadStream(filePath);
  const rlStream = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  let headerIndexMap: Map<string, number> | null = null;
  
  for await (const line of rlStream) {
    if (!line.trim()) continue;
    if (!headerIndexMap) {
      headerIndexMap = buildHeaderIndexMap(line);
      continue;
    }
    const cells = parseCsvLine(line);
    const getField = (fieldName: string): string => {
      const idx = headerIndexMap!.get(fieldName);
      if (idx === undefined || idx >= cells.length) return "";
      return cells[idx];
    };
    onRow(getField);
  }
}

async function main() {
  console.log("🚀 Starting missing developer pages enrichment...");

  const gamesFile = getLatestCsv("_games.csv");
  const icFile = getLatestCsv("_involved_companies.csv");
  const compFile = getLatestCsv("_companies.csv");

  if (!gamesFile || !icFile || !compFile) {
    console.error("❌ Required IGDB dump files are missing from 'scripts/igdb-dumps/'");
    console.log("💡 Please download them first using Option 14.2 in the Dev Portal.");
    process.exit(1);
  }

  // 1. Fetch games from local DB with missing developerNames
  console.log("💾 Fetching local games missing developer metadata...");
  const missingGames = await turso
    .select({
      id: schema.games.id,
      igdbId: schema.games.igdbId,
      title: schema.games.title
    })
    .from(schema.games)
    .where(
      sql`${schema.games.developerNames} IS NULL OR ${schema.games.developerNames} = ''`
    );

  console.log(`📋 Found ${missingGames.length} games missing developer names in local database.`);
  if (missingGames.length === 0) {
    console.log("✅ No missing developers to enrich.");
    process.exit(0);
  }

  // Map of igdbId -> gameId
  const gameMap = new Map<number, string>();
  for (const g of missingGames) {
    if (g.igdbId) {
      gameMap.set(g.igdbId, g.id);
    }
  }

  // 2. Stream involved_companies.csv to link gameId -> companyIds
  console.log(`📖 Streaming ${path.basename(icFile)} to find developer company relations...`);
  const gameToCompanyIds = new Map<number, Set<number>>();
  const neededCompanyIds = new Set<number>();

  await streamCsv(icFile, (getField) => {
    const gameId = parseInt(getField("game"), 10);
    const isDevVal = getField("developer").toLowerCase().trim();
    const isDeveloper = isDevVal === "true" || isDevVal === "1" || isDevVal === "t";

    if (isDeveloper && gameMap.has(gameId)) {
      const companyId = parseInt(getField("company"), 10);
      if (!isNaN(companyId)) {
        if (!gameToCompanyIds.has(gameId)) {
          gameToCompanyIds.set(gameId, new Set());
        }
        gameToCompanyIds.get(gameId)!.add(companyId);
        neededCompanyIds.add(companyId);
      }
    }
  });

  console.log(`🔗 Found ${neededCompanyIds.size} company IDs matching missing developer records.`);

  // 3. Stream companies.csv to load companyId -> companyName
  console.log(`📖 Streaming ${path.basename(compFile)} to load company names...`);
  const companyNames = new Map<number, string>();

  await streamCsv(compFile, (getField) => {
    const id = parseInt(getField("id"), 10);
    if (neededCompanyIds.has(id)) {
      const name = getField("name");
      if (name) {
        companyNames.set(id, name);
      }
    }
  });

  console.log(`✅ Loaded ${companyNames.size} company names.`);

  // 4. Fetch all developers currently registered to build cache
  console.log("💾 Fetching developers cache...");
  const dbDevs = await turso
    .select({ id: schema.developers.id, slug: schema.developers.slug })
    .from(schema.developers);
  const devCache = new Map<string, string>(); // slug -> id
  for (const d of dbDevs) {
    devCache.set(d.slug, d.id);
  }

  // Fetch existing relations
  const dbRelations = await turso
    .select({ gameId: schema.gamesToDevelopers.gameId, developerId: schema.gamesToDevelopers.developerId })
    .from(schema.gamesToDevelopers);
  const relationCache = new Map<string, Set<string>>();
  for (const r of dbRelations) {
    if (!relationCache.has(r.gameId)) {
      relationCache.set(r.gameId, new Set());
    }
    relationCache.get(r.gameId)!.add(r.developerId);
  }

  // 5. Build updates and new inserts
  console.log("🛠️ Building database updates...");
  const crypto = await import("crypto");
  function generateId(): string {
    return crypto.randomUUID();
  }

  const pendingDevs: Array<{ id: string; name: string; slug: string }> = [];
  const pendingLinks: Array<{ developerId: string; gameId: string }> = [];
  
  let gamesEnrichedCount = 0;
  let devsCreated = 0;

  const updatePromises: Array<Promise<any>> = [];
  const BATCH_SIZE = 40; // Safer concurrency limit for SQLite locks

  for (const game of missingGames) {
    if (!game.igdbId) continue;

    const compIds = gameToCompanyIds.get(game.igdbId);
    if (!compIds || compIds.size === 0) continue;

    const devNamesList: string[] = [];
    const gameRelations = relationCache.get(game.id) || new Set<string>();

    for (const companyId of compIds) {
      const name = companyNames.get(companyId);
      if (!name) continue;

      devNamesList.push(name);

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) continue;

      let devId = devCache.get(slug);
      if (!devId) {
        devId = generateId();
        pendingDevs.push({
          id: devId,
          name,
          slug
        });
        devCache.set(slug, devId);
        devsCreated++;
      }

      if (!gameRelations.has(devId)) {
        pendingLinks.push({
          developerId: devId,
          gameId: game.id
        });
        gameRelations.add(devId);
      }
    }

    if (devNamesList.length > 0) {
      const devNames = devNamesList.join(", ");
      
      const promise = turso
        .update(schema.games)
        .set({ developerNames: devNames })
        .where(eq(schema.games.id, game.id));
      
      updatePromises.push(promise);
      gamesEnrichedCount++;

      if (updatePromises.length >= BATCH_SIZE) {
        await Promise.all(updatePromises);
        updatePromises.length = 0;
        process.stdout.write(`\r  Enriched: ${gamesEnrichedCount} games...`);
      }
    }
  }

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
    console.log(`\n✅ Completed all game database updates.`);
  }

  // 6. Bulk inserts
  if (pendingDevs.length > 0) {
    console.log(`💾 Inserting ${pendingDevs.length} new developers in batches of 100...`);
    const BATCH_SIZE_DB = 100;
    for (let i = 0; i < pendingDevs.length; i += BATCH_SIZE_DB) {
      const batch = pendingDevs.slice(i, i + BATCH_SIZE_DB);
      await turso.insert(schema.developers).values(batch).onConflictDoNothing();
    }
  }

  if (pendingLinks.length > 0) {
    console.log(`💾 Inserting ${pendingLinks.length} new relations in batches of 100...`);
    const BATCH_SIZE_DB = 100;
    for (let i = 0; i < pendingLinks.length; i += BATCH_SIZE_DB) {
      const batch = pendingLinks.slice(i, i + BATCH_SIZE_DB);
      await turso.insert(schema.gamesToDevelopers).values(batch).onConflictDoNothing();
    }
  }

  console.log(`\n==================================================`);
  console.log(`✅ ENRICHMENT COMPLETE`);
  console.log(`==================================================`);
  console.log(`Games updated with developer names: ${gamesEnrichedCount}`);
  console.log(`New developers registered/pages added: ${devsCreated}`);
  console.log(`Game-to-Developer links created: ${pendingLinks.length}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Enrichment failed:", err);
});
