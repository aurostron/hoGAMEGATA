import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";

export interface CandidateGame {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  developerNames: string | null;
  releaseDate: number | null;
  source: string | null;
  coverUrl: string | null;
  scareRating: number | null;
  genres: string[];
  tags: string[];
}

async function main() {
  console.log("\n==================================================");
  console.log("🔍 HORROR INTEGRITY AUDIT: PASS 1 CLASSIFICATION");
  console.log("==================================================");

  const startTime = Date.now();
  const outDir = path.resolve(process.cwd(), "scripts/horror-audit/data");
  const backupDir = path.resolve(process.cwd(), "backups/horror-audit");

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // 1. Fetch all genres per game
  console.log("📦 Loading genres map from TursoDB...");
  const genresMap = new Map<string, string[]>();
  const genreRows = await rawDb.execute(`
    SELECT gg."A" as gameId, g.name as genreName
    FROM "_GameToGenre" gg
    JOIN "Genre" g ON g.id = gg."B"
  `);
  genreRows.rows.forEach((r: any) => {
    const arr = genresMap.get(r.gameId) || [];
    arr.push(r.genreName);
    genresMap.set(r.gameId, arr);
  });
  console.log(`✅ Loaded ${genreRows.rows.length} genre associations.`);

  // 2. Fetch all tags per game
  console.log("📦 Loading tags map from TursoDB...");
  const tagsMap = new Map<string, string[]>();
  const tagRows = await rawDb.execute(`
    SELECT gt."A" as gameId, t.name as tagName
    FROM "_GameToTag" gt
    JOIN "Tag" t ON t.id = gt."B"
  `);
  tagRows.rows.forEach((r: any) => {
    const arr = tagsMap.get(r.gameId) || [];
    arr.push(r.tagName);
    tagsMap.set(r.gameId, arr);
  });
  console.log(`✅ Loaded ${tagRows.rows.length} tag associations.`);

  // 3. Stream all active games
  console.log("📦 Querying all active games from TursoDB...");
  const gamesRes = await rawDb.execute(`
    SELECT id, slug, title, summary, "developerNames", "releaseDate", source, "coverUrl", "scareRating"
    FROM "Game"
    WHERE status IS NULL OR status != 'hidden'
  `);
  const allGames = gamesRes.rows;
  console.log(`✅ Loaded ${allGames.length} active games.`);

  // Recognized positive horror tag indicators
  const HORROR_TAG_KEYWORDS = [
    "horror", "survival horror", "psychological horror", "action horror", "puzzle horror",
    "supernatural horror", "narrative horror", "atmospheric horror", "spooky", "creepy",
    "dark", "zombies", "zombie", "gore", "monsters", "creatures", "fnaf",
    "five nights at freddy's", "ghosts", "haunted", "lovecraftian", "cosmic horror",
    "body horror", "slasher", "demon", "demons", "occult", "paranormal", "analog horror"
  ];

  // Utility / Non-game noise keywords (in title)
  const UTILITY_TITLE_REGEX = /\b(calculator|soundtrack|wallpaper|ost|runtime fee|sfx pack|sound effects|asset pack|engine test|template project|benchmark tool)\b/i;

  const tier1_coreHorror: CandidateGame[] = [];
  const tier2_definiteNoise: CandidateGame[] = [];
  const tier3_ambiguous: CandidateGame[] = [];

  for (const row of allGames) {
    const id = row.id as string;
    const title = (row.title as string) || "";
    const summary = (row.summary as string) || "";
    const lowerTitle = title.toLowerCase();
    const lowerSummary = summary.toLowerCase();
    const genres = genresMap.get(id) || [];
    const tags = tagsMap.get(id) || [];

    const item: CandidateGame = {
      id,
      slug: row.slug as string,
      title,
      summary: row.summary as string | null,
      developerNames: row.developerNames as string | null,
      releaseDate: row.releaseDate as number | null,
      source: row.source as string | null,
      coverUrl: row.coverUrl as string | null,
      scareRating: row.scareRating as number | null,
      genres,
      tags,
    };

    // Check 1: Definite Non-Game Utility / Noise (Tier 2)
    // Matches utility words, or explicit joke calculators
    if (UTILITY_TITLE_REGEX.test(lowerTitle)) {
      tier2_definiteNoise.push(item);
      continue;
    }

    // Check 2: Core Horror (Tier 1)
    // Has scareRating > 0
    if (item.scareRating !== null && item.scareRating > 0) {
      tier1_coreHorror.push(item);
      continue;
    }

    // Has explicit Horror genre
    const hasHorrorGenre = genres.some((g) => g.toLowerCase().includes("horror"));
    // Has explicit Horror tag
    const hasHorrorTag = tags.some((t) => {
      const lt = t.toLowerCase();
      return HORROR_TAG_KEYWORDS.some((kw) => lt.includes(kw));
    });

    // Check if suspicious genre is present (Sport, Racing, Card & Board Game, Music, Pinball)
    const hasSuspiciousGenre = genres.some((g) =>
      ["sport", "racing", "music", "pinball", "card & board game"].includes(g.toLowerCase())
    );

    // If it has suspicious genre AND no explicit horror tag/genre, it's Tier 3
    if (hasSuspiciousGenre && !hasHorrorGenre && !hasHorrorTag) {
      tier3_ambiguous.push(item);
      continue;
    }

    // If it has explicit horror genre/tag, it's Core Horror (Tier 1)
    if (hasHorrorGenre || hasHorrorTag) {
      tier1_coreHorror.push(item);
      continue;
    }

    // Check if summary mentions horror/dread/macabre keywords
    const mentionsHorrorKeywords =
      lowerSummary.includes("horror") ||
      lowerSummary.includes("terror") ||
      lowerSummary.includes("scary") ||
      lowerSummary.includes("creepy") ||
      lowerSummary.includes("dread") ||
      lowerSummary.includes("zombie") ||
      lowerSummary.includes("ghost") ||
      lowerSummary.includes("haunted") ||
      lowerSummary.includes("monster") ||
      lowerSummary.includes("nightmare") ||
      lowerSummary.includes("slasher") ||
      lowerSummary.includes("psychological");

    if (mentionsHorrorKeywords) {
      tier1_coreHorror.push(item);
    } else {
      // No explicit horror tag, no horror genre, no horror summary keywords
      tier3_ambiguous.push(item);
    }
  }

  console.log(`\n==================================================`);
  console.log(`📊 PASS 1 CLASSIFICATION RESULTS`);
  console.log(`==================================================`);
  console.log(`Total Active Games Scanned:     ${allGames.length}`);
  console.log(`🛡️ Tier 1 (Core Horror - Keep):  ${tier1_coreHorror.length} (${((tier1_coreHorror.length / allGames.length) * 100).toFixed(2)}%)`);
  console.log(`🗑️ Tier 2 (Definite Noise):       ${tier2_definiteNoise.length}`);
  console.log(`❓ Tier 3 (Ambiguous Candidates): ${tier3_ambiguous.length}`);
  console.log(`⏱️ Duration:                     ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`==================================================\n`);

  // Save artifacts
  fs.writeFileSync(path.join(outDir, "tier2_noise.json"), JSON.stringify(tier2_definiteNoise, null, 2), "utf-8");
  fs.writeFileSync(path.join(outDir, "tier3_ambiguous.json"), JSON.stringify(tier3_ambiguous, null, 2), "utf-8");

  // Save Pre-flight Snapshot of candidate items
  const snapshotFile = path.join(backupDir, `preflight_snapshot_pass1_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const snapshotData = {
    createdAt: new Date().toISOString(),
    totalActive: allGames.length,
    tier1Count: tier1_coreHorror.length,
    tier2Noise: tier2_definiteNoise,
    tier3Ambiguous: tier3_ambiguous,
  };
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshotData, null, 2), "utf-8");
  console.log(`📁 Saved pre-flight snapshot to: ${snapshotFile}`);
  console.log(`📁 Tier 2 Noise saved to: ${path.join(outDir, "tier2_noise.json")}`);
  console.log(`📁 Tier 3 Ambiguous saved to: ${path.join(outDir, "tier3_ambiguous.json")}`);
}

main().catch((err) => {
  console.error("❌ Classification error:", err);
  process.exit(1);
});
