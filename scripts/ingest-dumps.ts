import "./load-env";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { MOODS, getMoodTagsForGame } from "./mood-rules";
import {
  turso,
  schema,
  eq,
  or,
  inArray,
  getOrCreateGenre,
  getOrCreatePlatform,
  getOrCreateDeveloper,
  getOrCreatePublisher,
  getOrCreateTag,
  saveGame,
  sql
} from "./db-helper";

// --- Helper Functions ---

function getLatestCsv(suffix: string): string {
  const dir = path.join(process.cwd(), "scripts", "igdb-dumps");
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory ${dir} does not exist. Please download data dumps first.`);
  }
  const suffixWithoutUnderscore = suffix.startsWith("_") ? suffix.slice(1) : suffix;
  const files = fs.readdirSync(dir).filter(f => {
    const underscoreIndex = f.indexOf("_");
    if (underscoreIndex === -1) return false;
    const nameWithoutTimestamp = f.slice(underscoreIndex + 1);
    return nameWithoutTimestamp === suffixWithoutUnderscore;
  });
  if (files.length === 0) {
    throw new Error(`No CSV file found matching exact suffix "${suffixWithoutUnderscore}" in ${dir}`);
  }
  // Sort descending by name (timestamp prefix makes newest alphabetical)
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
        i++; // Skip escaped double quote
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
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  let headerIndexMap: Map<string, number> | null = null;
  
  for await (const line of rl) {
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

// --- Data Types ---

interface GameTempData {
  id: number;
  name: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  first_release_date: number | null;
  total_rating: number | null;
  follows: number | null;
  category: number | null;
  coverId: number | null;
  screenshotIds: number[];
  videoIds: number[];
  involvedCompanyIds: number[];
  platformIds: number[];
  genreIds: number[];
  keywordIds: number[];
  playerPerspectiveIds: number[];
  websiteIds: number[];
}

// --- Main Ingestion Logic ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const forceUpdate = args.includes("--force-update");
  
  let targetLimit = 200; // Default limit for safety/testing
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      targetLimit = parsedLimit;
    }
  }

  console.log("╔══════════════════════════════════════╗");
  console.log("║     Local IGDB Data Dump Ingest      ║");
  console.log("╚══════════════════════════════════════╝\n");
  if (dryRun) console.log("🧪 DRY-RUN MODE: No database changes will be written.\n");

  const horrorGenreId = await getOrCreateGenre("Horror", "horror");

  // Pre-upsert curated Mood Tags
  console.log("🏷️  Pre-upserting curated Mood Tags...");
  const moodTagMap = new Map<string, string>();
  for (const mood of MOODS) {
    const tagId = dryRun ? `tag-${mood.slug}` : await getOrCreateTag(mood.name, mood.slug);
    moodTagMap.set(mood.slug, tagId);
  }

  // --- PASS 1: Read & Filter Games ---
  const gamesPath = getLatestCsv("_games.csv");
  console.log(`📖 Loading and filtering horror games from ${path.basename(gamesPath)}...`);
  
  const gamesMap = new Map<number, GameTempData>();
  const neededCoverIds = new Set<number>();
  const neededScreenshotIds = new Set<number>();
  const neededVideoIds = new Set<number>();
  const neededInvolvedCompanyIds = new Set<number>();
  const neededPlatformIds = new Set<number>();
  const neededGenreIds = new Set<number>();
  const neededKeywordIds = new Set<number>();
  const neededPlayerPerspectiveIds = new Set<number>();
  const neededWebsiteIds = new Set<number>();

  let totalGamesChecked = 0;

  await streamCsv(gamesPath, (getField) => {
    totalGamesChecked++;
    const themes = extractNumbers(getField("themes"));
    const id = parseInt(getField("id"), 10);
    const coverId = parseInt(getField("cover"), 10);

    // Filter: must have theme 19 (Horror) and cover
    if (themes.includes(19) && !isNaN(coverId) && !isNaN(id)) {
      if (gamesMap.size >= targetLimit) return;

      const name = getField("name");
      const slug = getField("slug") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const screenshotIds = extractNumbers(getField("screenshots"));
      const videoIds = extractNumbers(getField("videos"));
      const involvedCompanyIds = extractNumbers(getField("involved_companies"));
      const platformIds = extractNumbers(getField("platforms"));
      const genreIds = extractNumbers(getField("genres"));
      const keywordIds = extractNumbers(getField("keywords"));
      const playerPerspectiveIds = extractNumbers(getField("player_perspectives"));
      const websiteIds = extractNumbers(getField("websites"));

      gamesMap.set(id, {
        id,
        name,
        slug,
        summary: getField("summary") || null,
        storyline: getField("storyline") || null,
        first_release_date: parseInt(getField("first_release_date"), 10) || null,
        total_rating: parseFloat(getField("total_rating")) || null,
        follows: parseInt(getField("follows"), 10) || null,
        category: parseInt(getField("category"), 10) || null,
        coverId,
        screenshotIds,
        videoIds,
        involvedCompanyIds,
        platformIds,
        genreIds,
        keywordIds,
        playerPerspectiveIds,
        websiteIds,
      });

      neededCoverIds.add(coverId);
      screenshotIds.forEach(x => neededScreenshotIds.add(x));
      videoIds.forEach(x => neededVideoIds.add(x));
      involvedCompanyIds.forEach(x => neededInvolvedCompanyIds.add(x));
      platformIds.forEach(x => neededPlatformIds.add(x));
      genreIds.forEach(x => neededGenreIds.add(x));
      keywordIds.forEach(x => neededKeywordIds.add(x));
      playerPerspectiveIds.forEach(x => neededPlayerPerspectiveIds.add(x));
      websiteIds.forEach(x => neededWebsiteIds.add(x));
    }
  });

  console.log(`🔍 Scanned ${totalGamesChecked.toLocaleString()} total games.`);
  console.log(`🎯 Identified ${gamesMap.size} horror games to process (limit: ${targetLimit}).`);

  if (gamesMap.size === 0) {
    console.log("ℹ️ No horror games found to ingest.");
    return;
  }

  // --- PASS 2: Load and Join Related Data ---
  console.log("\n🔗 Loading relation files...");

  // 2.1 Covers
  const coversMap = new Map<number, string>();
  try {
    const coversPath = getLatestCsv("_covers.csv");
    console.log(`  ➡  Processing covers from ${path.basename(coversPath)}...`);
    await streamCsv(coversPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededCoverIds.has(id)) {
        coversMap.set(id, getField("url"));
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Cover load warning: ${e.message}`);
  }

  // 2.2 Screenshots
  const screenshotsMap = new Map<number, string>();
  try {
    const screenshotsPath = getLatestCsv("_screenshots.csv");
    console.log(`  ➡  Processing screenshots from ${path.basename(screenshotsPath)}...`);
    await streamCsv(screenshotsPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededScreenshotIds.has(id)) {
        screenshotsMap.set(id, getField("url"));
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Screenshot load warning: ${e.message}`);
  }

  // 2.3 Videos
  const videosMap = new Map<number, string>();
  try {
    const videosPath = getLatestCsv("_game_videos.csv");
    console.log(`  ➡  Processing videos from ${path.basename(videosPath)}...`);
    await streamCsv(videosPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededVideoIds.has(id)) {
        videosMap.set(id, getField("video_id"));
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Video load warning: ${e.message}`);
  }

  // 2.4 Platforms
  const platformsMap = new Map<number, { name: string; slug: string }>();
  try {
    const platformsPath = getLatestCsv("_platforms.csv");
    console.log(`  ➡  Processing platforms from ${path.basename(platformsPath)}...`);
    await streamCsv(platformsPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededPlatformIds.has(id)) {
        const name = getField("name");
        platformsMap.set(id, {
          name,
          slug: getField("slug") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Platform load warning: ${e.message}`);
  }

  // 2.5 Genres
  const genresMap = new Map<number, { name: string; slug: string }>();
  try {
    const genresPath = getLatestCsv("_genres.csv");
    console.log(`  ➡  Processing genres from ${path.basename(genresPath)}...`);
    await streamCsv(genresPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededGenreIds.has(id)) {
        const name = getField("name");
        genresMap.set(id, {
          name,
          slug: getField("slug") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Genre load warning: ${e.message}`);
  }

  // 2.6 Keywords
  const keywordsMap = new Map<number, { name: string; slug: string }>();
  try {
    const keywordsPath = getLatestCsv("_keywords.csv");
    console.log(`  ➡  Processing keywords from ${path.basename(keywordsPath)}...`);
    await streamCsv(keywordsPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededKeywordIds.has(id)) {
        const name = getField("name");
        keywordsMap.set(id, {
          name,
          slug: getField("slug") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Keyword load warning: ${e.message}`);
  }

  // 2.7 Player Perspectives
  const playerPerspectivesMap = new Map<number, { name: string; slug: string }>();
  try {
    const ppPath = getLatestCsv("_player_perspectives.csv");
    console.log(`  ➡  Processing player perspectives from ${path.basename(ppPath)}...`);
    await streamCsv(ppPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededPlayerPerspectiveIds.has(id)) {
        const name = getField("name");
        playerPerspectivesMap.set(id, {
          name,
          slug: getField("slug") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Player perspective load warning: ${e.message}`);
  }

  // 2.8 Websites
  const websitesMap = new Map<number, { url: string; category: number }>();
  try {
    const websitesPath = getLatestCsv("_websites.csv");
    console.log(`  ➡  Processing websites from ${path.basename(websitesPath)}...`);
    await streamCsv(websitesPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededWebsiteIds.has(id)) {
        websitesMap.set(id, {
          url: getField("url"),
          category: parseInt(getField("category"), 10) || 0,
        });
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Website load warning: ${e.message}`);
  }

  // 2.9 Involved Companies & Companies
  const involvedCompaniesMap = new Map<number, { companyId: number; developer: boolean; publisher: boolean }>();
  const neededCompanyIds = new Set<number>();
  try {
    const icPath = getLatestCsv("_involved_companies.csv");
    console.log(`  ➡  Processing involved companies mapping from ${path.basename(icPath)}...`);
    await streamCsv(icPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededInvolvedCompanyIds.has(id)) {
        const companyId = parseInt(getField("company"), 10);
        const devVal = getField("developer");
        const pubVal = getField("publisher");
        const developer = devVal === "true" || devVal === "1";
        const publisher = pubVal === "true" || pubVal === "1";

        if (!isNaN(companyId)) {
          involvedCompaniesMap.set(id, { companyId, developer, publisher });
          neededCompanyIds.add(companyId);
        }
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Involved companies load warning: ${e.message}`);
  }

  const companiesMap = new Map<number, { name: string; slug: string }>();
  try {
    const companiesPath = getLatestCsv("_companies.csv");
    console.log(`  ➡  Processing companies names from ${path.basename(companiesPath)}...`);
    await streamCsv(companiesPath, (getField) => {
      const id = parseInt(getField("id"), 10);
      if (neededCompanyIds.has(id)) {
        const name = getField("name");
        companiesMap.set(id, {
          name,
          slug: getField("slug") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
      }
    });
  } catch (e: any) {
    console.warn(`  ⚠️ Companies load warning: ${e.message}`);
  }

  // --- PASS 3: Pre-upsert entities & filter existing games ---
  console.log("\n📦 Pre-upserting related platforms, genres, developers and publishers...");

  const platformDbMap = new Map<number, string>();
  if (!dryRun) {
    for (const [igdbId, plat] of platformsMap.entries()) {
      const dbId = await getOrCreatePlatform(plat.name, plat.slug, igdbId);
      platformDbMap.set(igdbId, dbId);
    }
  }

  const genreDbMap = new Map<number, string>();
  if (!dryRun) {
    for (const [igdbId, gen] of genresMap.entries()) {
      const dbId = await getOrCreateGenre(gen.name, gen.slug, igdbId);
      genreDbMap.set(igdbId, dbId);
    }
  }

  // Resolve developer / publisher db mapping
  const developerDbMap = new Map<number, string>(); // companyId -> dbId
  const publisherDbMap = new Map<number, string>(); // companyId -> dbId

  if (!dryRun) {
    for (const [compId, comp] of companiesMap.entries()) {
      // Find if company acts as developer or publisher in our mappings
      let isDev = false;
      let isPub = false;
      for (const ic of involvedCompaniesMap.values()) {
        if (ic.companyId === compId) {
          if (ic.developer) isDev = true;
          if (ic.publisher) isPub = true;
        }
      }

      if (isDev) {
        const dbId = await getOrCreateDeveloper(comp.name, comp.slug, compId);
        developerDbMap.set(compId, dbId);
      }
      if (isPub) {
        const dbId = await getOrCreatePublisher(comp.name, comp.slug, compId);
        publisherDbMap.set(compId, dbId);
      }
    }
  }

  // Check existing games in database to skip duplicates
  const existingSlugs = new Set<string>();
  const existingIgdbIds = new Set<number>();

  if (!dryRun && !forceUpdate) {
    console.log("🔍 Fetching existing games to skip duplicates...");
    const batchSlugs = Array.from(gamesMap.values()).map(g => g.slug);
    const batchIgdbIds = Array.from(gamesMap.values()).map(g => g.id);

    // Drizzle has a limitation on query parameter size for large arrays (SQLITE_LIMIT_VARIABLE_LIMIT).
    // Let's do chunking of these checks if there are a lot of them.
    const CHUNK_SIZE = 500;
    for (let c = 0; c < batchSlugs.length; c += CHUNK_SIZE) {
      const slugsChunk = batchSlugs.slice(c, c + CHUNK_SIZE);
      const idsChunk = batchIgdbIds.slice(c, c + CHUNK_SIZE);

      const existingRows = await turso
        .select({ id: schema.games.id, slug: schema.games.slug, igdbId: schema.games.igdbId })
        .from(schema.games)
        .where(
          or(
            inArray(schema.games.slug, slugsChunk),
            inArray(schema.games.igdbId, idsChunk)
          )
        );

      existingRows.forEach(row => {
        existingSlugs.add(row.slug);
        if (row.igdbId !== null) existingIgdbIds.add(row.igdbId);
      });
    }
  }

  // --- PASS 4: Process and Insert Games ---
  console.log("\n🚀 Commencing game ingestion...");

  const gamesList = Array.from(gamesMap.values());
  let processedCount = 0;
  let skippedCount = 0;

  // Process in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < gamesList.length; i += BATCH_SIZE) {
    const chunk = gamesList.slice(i, i + BATCH_SIZE);

    const promises = chunk.map(async (g) => {
      // Check duplicate
      if (!forceUpdate && (existingSlugs.has(g.slug) || existingIgdbIds.has(g.id))) {
        skippedCount++;
        return;
      }

      const releaseDate = g.first_release_date ? new Date(g.first_release_date * 1000) : null;
      const status = releaseDate && releaseDate > new Date() ? "upcoming" : "released";

      // Resolve cover
      let coverUrl = null;
      const coverRaw = coversMap.get(g.coverId || 0);
      if (coverRaw) {
        coverUrl = coverRaw.startsWith("//") ? `https:${coverRaw}` : coverRaw;
        coverUrl = coverUrl.replace("t_thumb", "t_cover_big");
      }

      // Resolve screenshots
      const screenshots: string[] = [];
      g.screenshotIds.forEach(sId => {
        const sRaw = screenshotsMap.get(sId);
        if (sRaw) {
          const sUrl = sRaw.startsWith("//") ? `https:${sRaw}` : sRaw;
          screenshots.push(sUrl.replace("t_thumb", "t_screenshot_huge"));
        }
      });

      // Resolve trailer
      let trailerUrl = null;
      if (g.videoIds.length > 0) {
        const vid = videosMap.get(g.videoIds[0]);
        if (vid) trailerUrl = `https://www.youtube.com/embed/${vid}`;
      }

      // Resolve developers / publishers
      const developerIds: string[] = [];
      const publisherIds: string[] = [];
      const devNamesSet = new Set<string>();

      g.involvedCompanyIds.forEach(icId => {
        const ic = involvedCompaniesMap.get(icId);
        if (ic) {
          const comp = companiesMap.get(ic.companyId);
          if (comp) {
            if (ic.developer) {
              devNamesSet.add(comp.name);
              const dbId = developerDbMap.get(ic.companyId);
              if (dbId) developerIds.push(dbId);
            }
            if (ic.publisher) {
              const dbId = publisherDbMap.get(ic.companyId);
              if (dbId) publisherIds.push(dbId);
            }
          }
        }
      });

      // Resolve platform / genre database IDs
      const platformIds: string[] = [];
      g.platformIds.forEach(pId => {
        const dbId = platformDbMap.get(pId);
        if (dbId) platformIds.push(dbId);
      });

      const genreIds: string[] = [];
      g.genreIds.forEach(gId => {
        const dbId = genreDbMap.get(gId);
        if (dbId) genreIds.push(dbId);
      });
      if (!genreIds.includes(horrorGenreId)) {
        genreIds.push(horrorGenreId);
      }

      // Resolve human names for denormalized text columns
      const developerNames = Array.from(devNamesSet).join(", ");
      const genreNames = Array.from(new Set([
        "Horror",
        ...g.genreIds.map(gId => genresMap.get(gId)?.name).filter((x): x is string => !!x)
      ])).join(", ");
      const platformNames = g.platformIds.map(pId => platformsMap.get(pId)?.name).filter(Boolean).join(", ");

      // Purchase links from websites
      const purchaseLinks: Array<{ storeName: string; url: string }> = [];
      g.websiteIds.forEach(webId => {
        const w = websitesMap.get(webId);
        if (w) {
          let storeName = "";
          if (w.category === 13) storeName = "Steam";
          else if (w.category === 14) storeName = "GOG";
          else if (w.category === 16) storeName = "Epic Games Store";
          else if (w.category === 17) storeName = "Itch.io";

          if (storeName) {
            purchaseLinks.push({ storeName, url: w.url });
          }
        }
      });

      // Apply Mood tagging rules automatically
      const tagIds: string[] = [];
      const matchedMoods = await getMoodTagsForGame({
        title: g.name,
        summary: g.summary || "",
        storyline: g.storyline || "",
        genreNames: g.genreIds.map(gId => genresMap.get(gId)?.name).filter((x): x is string => !!x),
        keywords: g.keywordIds.map(kId => keywordsMap.get(kId)?.name).filter((x): x is string => !!x),
        playerPerspectives: g.playerPerspectiveIds.map(pId => playerPerspectivesMap.get(pId)?.name).filter((x): x is string => !!x)
      });

      for (const moodSlug of matchedMoods) {
        const tId = moodTagMap.get(moodSlug);
        if (tId) tagIds.push(tId);
      }

      if (dryRun) {
        console.log(`🧪 [DRY-RUN] Would ingest: "${g.name}" (Release: ${releaseDate?.toLocaleDateString() || "N/A"})`);
        processedCount++;
        return;
      }

      try {
        await saveGame({
          igdbId: g.id,
          title: g.name,
          slug: g.slug,
          summary: g.summary,
          storyline: g.storyline,
          releaseDate,
          status,
          coverUrl,
          rating: g.total_rating,
          popularity: g.follows,
          trailerUrl,
          screenshots,
          category: g.category,
          developerNames,
          genreNames,
          platformNames,
          source: "igdb",
          developerIds,
          publisherIds,
          genreIds,
          platformIds,
          tagIds,
          purchaseLinks,
        });

        processedCount++;
        if (processedCount % 20 === 0) {
          console.log(` Ingested ${processedCount} games...`);
        }
      } catch (err: any) {
        console.error(`⚠️ Failed to ingest "${g.name}":`, err.message);
      }
    });

    await Promise.all(promises);
  }

  console.log("\n==================================================");
  console.log("🏁 LOCAL INGESTION PROCESS COMPLETED");
  console.log("==================================================");
  console.log(`Processed/Saved Games:  ${processedCount}`);
  console.log(`Skipped (Duplicates):   ${skippedCount}`);
  console.log("==================================================\n");
}

main().catch((e) => {
  console.error("❌ Fatal Ingestion Error:", e);
  process.exit(1);
});
