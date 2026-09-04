import * as fs from "fs";
import * as path from "path";

interface SnapshotGame {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  coverUrl: string | null;
  releaseDate: number | null;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  scareRating: number | null;
  steamRating: number | null;
  metacritic: number | null;
  status: string | null;
  [key: string]: any;
}

interface PurchaseLink {
  id: string;
  gameId: string;
  storeName: string;
  url: string;
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function tokenize(str: string): string[] {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !["games", "studio", "studios", "entertainment", "interactive", "inc", "ltd", "corp", "the", "and", "llc", "production"].includes(t));
}

function haveDevOverlap(devStrA: string, devStrB: string): boolean {
  if (!devStrA || !devStrB) return false;
  const tokensA = tokenize(devStrA);
  const tokensB = tokenize(devStrB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  return tokensA.some(t => tokensB.includes(t));
}

function parseYear(dateVal: number | null): number | null {
  if (!dateVal) return null;
  const ms = dateVal < 1e11 ? dateVal * 1000 : dateVal;
  const d = new Date(ms);
  const y = d.getFullYear();
  return (y >= 1970 && y <= 2035) ? y : null;
}

function hasRemakeKeywords(g: SnapshotGame): boolean {
  const text = `${g.title} ${g.slug} ${g.summary || ""} ${g.storyline || ""}`.toLowerCase();
  const keywords = [
    "remake",
    "reimagining",
    "re-imagining",
    "ground-up reimagining",
    "hd collection",
    "remaster",
    "remastered",
    "reboot",
    "definitive edition",
    "enhanced edition"
  ];
  return keywords.some(k => text.includes(k));
}

function extractStoreId(url: string): string | null {
  if (!url) return null;
  const steamMatch = url.match(/store\.steampowered\.com\/app\/(\d+)/);
  if (steamMatch) return `steam:${steamMatch[1]}`;
  const gogMatch = url.match(/gog\.com\/(?:[a-z]{2}\/)?game\/([a-z0-9_]+)/);
  if (gogMatch) return `gog:${gogMatch[1]}`;
  const itchMatch = url.match(/([a-z0-9-_]+\.itch\.io\/[a-z0-9-_]+)/);
  if (itchMatch) return `itch:${itchMatch[1]}`;
  return null;
}

async function main() {
  console.log("\n==================================================");
  console.log("🔬 PHASE 2: CLUSTER EVALUATION & REFINED PARTITIONING");
  console.log("==================================================");

  // 1. Load latest snapshot
  const backupsDir = path.resolve(process.cwd(), "backups");
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("dedup_snapshot_") && f.endsWith(".json")).sort().reverse();
  if (files.length === 0) {
    console.error("❌ No snapshot found in backups/!");
    process.exit(1);
  }
  const latestSnapshotPath = path.join(backupsDir, files[0]);
  console.log(`📂 Loading snapshot from: ${latestSnapshotPath}`);

  const snapshot = JSON.parse(fs.readFileSync(latestSnapshotPath, "utf-8"));
  console.log(`📦 Loaded ${snapshot.games.length} games across ${snapshot.totalDuplicateGroups} groups.`);

  // Build lookup maps
  const purchaseLinksByGame = new Map<string, PurchaseLink[]>();
  for (const link of snapshot.purchaseLinks) {
    if (!purchaseLinksByGame.has(link.gameId)) purchaseLinksByGame.set(link.gameId, []);
    purchaseLinksByGame.get(link.gameId)!.push(link);
  }

  // Group games by normalized title
  const groupsByTitle = new Map<string, SnapshotGame[]>();
  for (const g of snapshot.games) {
    const key = normalizeTitle(g.title);
    if (!groupsByTitle.has(key)) groupsByTitle.set(key, []);
    groupsByTitle.get(key)!.push(g);
  }

  console.log(`🔍 Grouped into ${groupsByTitle.size} normalized title clusters.`);

  const poolA: any[] = []; // 100% Safe Auto-Merge
  const poolB: any[] = []; // Remake / Separate Release Protected
  const poolC: any[] = []; // Gray-Zone Ambiguous (Gemini 2.5 Flash Arbiter)

  for (const [normTitle, games] of groupsByTitle.entries()) {
    if (games.length < 2) continue;

    // Attach links and store IDs
    for (const g of games) {
      g.links = purchaseLinksByGame.get(g.id) || [];
      g.storeIds = g.links.map((l: any) => extractStoreId(l.url)).filter(Boolean);
      g.parsedYear = parseYear(g.releaseDate);
      g.hasRemakeSignal = hasRemakeKeywords(g);
    }

    const allDevStrs = games.map((g: any) => g.developerNames || "").filter(Boolean);
    const hasAllDevs = allDevStrs.length === games.length;
    const hasNoDevs = allDevStrs.length === 0;

    const years = games.map((g: any) => g.parsedYear).filter((y: any): y is number => y !== null);
    const minYear = years.length > 0 ? Math.min(...years) : null;
    const maxYear = years.length > 0 ? Math.max(...years) : null;
    const yearGap = (minYear !== null && maxYear !== null) ? maxYear - minYear : 0;

    const anyRemakeKeyword = games.some((g: any) => g.hasRemakeSignal);

    // Check developer consistency
    let hasDevConflict = false;
    let hasDevOverlap = false;

    if (allDevStrs.length >= 2) {
      for (let i = 0; i < games.length; i++) {
        for (let j = i + 1; j < games.length; j++) {
          const devA = games[i].developerNames;
          const devB = games[j].developerNames;
          if (devA && devB) {
            if (haveDevOverlap(devA, devB)) {
              hasDevOverlap = true;
            } else {
              hasDevConflict = true;
            }
          }
        }
      }
    }

    // Check shared store ID
    let hasSharedStoreId = false;
    for (let i = 0; i < games.length; i++) {
      for (let j = i + 1; j < games.length; j++) {
        const shared = games[i].storeIds.filter((id: string) => games[j].storeIds.includes(id));
        if (shared.length > 0) {
          hasSharedStoreId = true;
          break;
        }
      }
      if (hasSharedStoreId) break;
    }

    // --- REFINED PARTITIONING LOGIC ---

    // 1. Check for REMAKE / REBOOT / SEPARATE RELEASE GUARDS (Pool B)
    if (hasDevConflict && (yearGap >= 3 || anyRemakeKeyword)) {
      poolB.push({
        type: "REMAKE_DIFFERENT_DEV_OR_YEAR_GAP",
        title: games[0].title,
        normTitle,
        games,
        devs: allDevStrs.join(" vs "),
        years: years.join(" vs "),
        yearGap,
        reason: anyRemakeKeyword ? "Remake/Remaster keywords detected" : `Developer conflict with ${yearGap}yr release gap`
      });
      continue;
    }

    if (!hasDevConflict && anyRemakeKeyword && yearGap >= 3) {
      poolB.push({
        type: "REMAKE_KEYWORD_LARGE_YEAR_GAP",
        title: games[0].title,
        normTitle,
        games,
        devs: allDevStrs.join(" vs "),
        years: years.join(" vs "),
        yearGap,
        reason: "Remake keyword with significant year difference"
      });
      continue;
    }

    // 2. Check for 100% SAFE AUTO-MERGES (Pool A)
    // Condition A1: Matching/overlapping developer AND no dev conflicts AND year gap <= 2 (or missing dates) AND no remake signal
    if (hasAllDevs && hasDevOverlap && !hasDevConflict && yearGap <= 2 && !anyRemakeKeyword) {
      poolA.push({
        type: "MATCHING_DEV_CONSISTENT",
        title: games[0].title,
        normTitle,
        games,
        devs: allDevStrs.join(" | "),
        years: years.join(" | ")
      });
      continue;
    }

    // Condition A2: Shared Store ID AND no dev conflict AND no remake signal
    if (hasSharedStoreId && !hasDevConflict && !anyRemakeKeyword && yearGap <= 2) {
      poolA.push({
        type: "SHARED_STORE_ID_SAFE",
        title: games[0].title,
        normTitle,
        games,
        devs: allDevStrs.join(" | "),
        years: years.join(" | ")
      });
      continue;
    }

    // Condition A3: Itch scraper pair where one is itch-[title] and other is main title with matching dev
    const itchGame = games.find((g: any) => g.slug.startsWith("itch-"));
    const mainGame = games.find((g: any) => !g.slug.startsWith("itch-"));
    if (games.length === 2 && itchGame && mainGame && !anyRemakeKeyword) {
      if (itchGame.developerNames && mainGame.developerNames && haveDevOverlap(itchGame.developerNames, mainGame.developerNames)) {
        poolA.push({
          type: "ITCH_CROSS_STORE_MATCHING_DEV",
          title: games[0].title,
          normTitle,
          games,
          devs: `${mainGame.developerNames} (Main) vs ${itchGame.developerNames} (Itch)`
        });
        continue;
      }
    }

    // 3. ALL OTHER CASES -> Pool C (Gray Zone / Ambiguous -> Handled by Gemini 2.5 Flash)
    poolC.push({
      type: hasNoDevs ? "MISSING_ALL_DEV" : (hasDevConflict ? "DIFFERENT_DEV_CLOSE_YEAR" : "PARTIAL_DEV_INFO"),
      title: games[0].title,
      normTitle,
      games,
      devs: allDevStrs.join(" vs ") || "None",
      years: years.join(" vs ") || "N/A",
      yearGap
    });
  }

  // Save partitioned pools
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pipeline/data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(path.join(dataDir, "pool_a.json"), JSON.stringify(poolA, null, 2));
  fs.writeFileSync(path.join(dataDir, "pool_b.json"), JSON.stringify(poolB, null, 2));
  fs.writeFileSync(path.join(dataDir, "pool_c.json"), JSON.stringify(poolC, null, 2));

  console.log(`\n==================================================`);
  console.log(`📊 REFINED PARTITIONING SUMMARY`);
  console.log(`==================================================`);
  console.log(`🟢 Pool A (Zero-Risk Auto-Merge):       ${poolA.length} groups (${poolA.reduce((sum, g) => sum + g.games.length, 0)} games)`);
  console.log(`🔴 Pool B (Remake Guard - Protected):    ${poolB.length} groups (${poolB.reduce((sum, g) => sum + g.games.length, 0)} games)`);
  console.log(`🟡 Pool C (Gray Zone - Gemini Arbiter):  ${poolC.length} groups (${poolC.reduce((sum, g) => sum + g.games.length, 0)} games)`);
  console.log(`==================================================\n`);

  console.log(`📋 Sample Pool A (Safe Auto-Merges):`);
  poolA.slice(0, 5).forEach((p, i) => {
    console.log(`  [${i + 1}] "${p.title}" (${p.type}) - ${p.games.length} listings: ${p.games.map((g: any) => `${g.slug} [${g.developerNames || 'No Dev'}]`).join(", ")}`);
  });

  console.log(`\n🛡️ Sample Pool B (Protected Remakes/Editions):`);
  poolB.slice(0, 8).forEach((p, i) => {
    console.log(`  [${i + 1}] "${p.title}" (${p.reason}) - Devs: ${p.devs} | Years: ${p.years}`);
    p.games.forEach((g: any) => console.log(`      -> ${g.slug} (${g.developerNames}) [${g.parsedYear || 'No Year'}]`));
  });

  console.log(`\n🤖 Sample Pool C (Ambiguous / AI Input Needed):`);
  poolC.slice(0, 5).forEach((p, i) => {
    console.log(`  [${i + 1}] "${p.title}" (${p.type}) - Devs: ${p.devs} | Years: ${p.years}`);
    p.games.forEach((g: any) => console.log(`      -> ${g.slug} (${g.developerNames || 'No dev'}) [${g.parsedYear || 'No Year'}]`));
  });
}

main().catch(err => {
  console.error("❌ Evaluation failed:", err);
  process.exit(1);
});
