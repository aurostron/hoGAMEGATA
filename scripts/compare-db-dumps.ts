import "./load-env";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

// --- Database Connection ---
async function getDbStats() {
  const { turso, initTursoForRequest } = await import("../src/lib/turso");
  const { games } = await import("../src/db/schema");

  // Lazy initialize Turso using loaded environment variables
  initTursoForRequest(process.env);

  console.log("💾 Fetching local database statistics from Turso...");
  const dbGames = await turso
    .select({
      id: games.id,
      igdbId: games.igdbId,
      slug: games.slug,
      title: games.title
    })
    .from(games);

  const totalLocal = dbGames.length;
  const localIgdbIds = new Set<number>();
  const localSlugs = new Set<string>();

  for (const g of dbGames) {
    if (g.igdbId) {
      localIgdbIds.add(g.igdbId);
    }
    if (g.slug) {
      localSlugs.add(g.slug);
    }
  }

  return { totalLocal, localIgdbIds, localSlugs };
}

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

function extractNumbers(field: string): number[] {
  if (!field) return [];
  const matches = field.match(/\d+/g);
  if (!matches) return [];
  return matches.map(n => parseInt(n, 10));
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

// --- Download Dump Logic ---
async function getToken(): Promise<string> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in .env");
  }
  console.log("🔑 Authenticating with Twitch...");
  const body = `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
  const resp = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error(`Twitch auth failed: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

async function downloadDumpFile(endpoint: string): Promise<string> {
  const token = await getToken();
  console.log(`📡 Fetching available data dump info for "${endpoint}"...`);
  
  const resp = await fetch(`https://api.igdb.com/v4/dumps/${endpoint}`, {
    method: "GET",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    throw new Error(`IGDB fetch failed: ${resp.status} ${await resp.text()}`);
  }
  const info = (await resp.json()) as { file_name: string; s3_url: string; size_bytes: number; schema_version: number; schema: any };
  
  if (!info.s3_url) {
    throw new Error(`No S3 URL found for "${endpoint}"`);
  }

  const downloadsDir = path.join(process.cwd(), "scripts", "igdb-dumps");
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const destPath = path.join(downloadsDir, info.file_name);
  console.log(`⬇️ Downloading dump file: ${info.file_name} (${(info.size_bytes / (1024 * 1024)).toFixed(1)} MB)...`);
  
  const dlResp = await fetch(info.s3_url);
  if (!dlResp.ok) throw new Error(`Download failed: ${dlResp.status} ${dlResp.statusText}`);
  const fileStream = fs.createWriteStream(destPath);
  const reader = dlResp.body?.getReader();
  if (!reader) throw new Error("No response body");

  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    received += value.length;
    process.stdout.write(`\r  Downloading... ${((received / info.size_bytes) * 100).toFixed(1)}%`);
  }
  fileStream.end();
  await new Promise<void>((resolve) => fileStream.on("finish", resolve));
  
  // Write schema info
  const schemaPath = destPath.replace(".csv", "_schema.json");
  fs.writeFileSync(schemaPath, JSON.stringify({ endpoint: info.endpoint, schema_version: info.schema_version, schema: info.schema }, null, 2));
  console.log(`\n✅ Saved dump file and schema to ${destPath}`);

  return destPath;
}

// --- Main Comparison Logic ---
async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     hoGAMEGATA vs IGDB Dump Check    ║");
  console.log("╚══════════════════════════════════════╝\n");

  let gamesPath = getLatestCsv("_games.csv");

  if (!gamesPath) {
    console.log("❌ The IGDB games data dump file (_games.csv) was not found locally.");
    const decision = await ask("Would you like to fetch and download the latest games dump from IGDB? (y/n): ");
    if (decision.toLowerCase() === "y") {
      try {
        gamesPath = await downloadDumpFile("games");
      } catch (err: any) {
        console.error(`\n❌ Failed to download dump: ${err.message}`);
        rl.close();
        process.exit(1);
      }
    } else {
      console.log("Exited.");
      rl.close();
      process.exit(0);
    }
  }

  const { totalLocal, localIgdbIds, localSlugs } = await getDbStats();

  console.log(`\n📖 Reading and analyzing data dump from ${path.basename(gamesPath!)}...`);
  
  let totalDumpCount = 0;
  let totalDumpHorror = 0;
  
  interface MissingGame {
    id: number;
    name: string;
    slug: string;
    rating: number;
    follows: number;
    releaseDate: string;
  }

  const missingHorrorGames: MissingGame[] = [];

  await streamCsv(gamesPath!, (getField) => {
    totalDumpCount++;
    const id = parseInt(getField("id"), 10);
    if (isNaN(id)) return;

    const themes = extractNumbers(getField("themes"));
    const isHorror = themes.includes(19);

    if (isHorror) {
      totalDumpHorror++;
      
      const slug = getField("slug") || getField("name").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const isAlreadyImported = localIgdbIds.has(id) || localSlugs.has(slug);

      if (!isAlreadyImported) {
        const follows = parseInt(getField("follows"), 10) || 0;
        const rating = parseFloat(getField("total_rating")) || 0.0;
        
        let releaseDate = "Unknown";
        const dateTs = parseInt(getField("first_release_date"), 10);
        if (!isNaN(dateTs)) {
          releaseDate = new Date(dateTs * 1000).toISOString().split("T")[0];
        }

        missingHorrorGames.push({
          id,
          name: getField("name"),
          slug,
          rating,
          follows,
          releaseDate
        });
      }
    }
  });

  const importedHorrorCount = totalDumpHorror - missingHorrorGames.length;
  const coveragePercent = totalDumpHorror > 0 ? (importedHorrorCount / totalDumpHorror) * 100 : 0.0;

  console.log("\n==================================================");
  console.log("📊 COMPARISON REPORT");
  console.log("==================================================");
  console.log(`📈 Total Games in IGDB Dump:           ${totalDumpCount.toLocaleString()}`);
  console.log(`🧟 Horror Games (Theme 19) in Dump:     ${totalDumpHorror.toLocaleString()}`);
  console.log(`💾 Total Games in Local Database:       ${totalLocal.toLocaleString()}`);
  console.log(`🔗 Mapped/Imported Horror Games:        ${importedHorrorCount.toLocaleString()}`);
  console.log(`🎯 Horror Catalog Coverage:            ${coveragePercent.toFixed(2)}%`);
  console.log(`⚠️  Missing Horror Games to Ingest:      ${missingHorrorGames.length.toLocaleString()}`);
  console.log("==================================================");

  if (missingHorrorGames.length > 0) {
    console.log("\n🏆 TOP 15 POPULAR MISSING HORROR GAMES (BY FOLLOWS):");
    console.log("--------------------------------------------------");
    
    // Sort by follows desc, then rating desc
    missingHorrorGames.sort((a, b) => {
      if (b.follows !== a.follows) return b.follows - a.follows;
      return b.rating - a.rating;
    });

    const top15 = missingHorrorGames.slice(0, 15);
    top15.forEach((game, idx) => {
      console.log(
        `${(idx + 1).toString().padEnd(2)} | ID: ${game.id.toString().padEnd(7)} | ${game.name.padEnd(40)} | Follows: ${game.follows.toString().padEnd(4)} | Rating: ${game.rating.toFixed(1).padEnd(5)} | Released: ${game.releaseDate}`
      );
    });
    console.log("--------------------------------------------------");
    console.log(`💡 You can import any game using Option 1.4 in the Dev Portal console, or run:`);
    console.log(`   npx tsx scripts/add-custom-game.ts --id <ID>`);
  }

  rl.close();
}

main().catch((err) => {
  console.error("❌ Comparison execution failed:", err);
  rl.close();
});
