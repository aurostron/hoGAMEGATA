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
  source: string | null;
  [key: string]: any;
}

interface PurchaseLink {
  id: string;
  gameId: string;
  storeName: string;
  url: string;
}

function normalizeTitle(t: string): string {
  return (t || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
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
  // If either is "Independent Creator", ignore as a match token
  if (devStrA.toLowerCase() === "independent creator" || devStrB.toLowerCase() === "independent creator") {
    return false;
  }
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

function extractItchCreator(url: string): string | null {
  if (!url) return null;
  const m = url.match(/https?:\/\/([a-z0-9-_]+)\.itch\.io/i);
  return m ? m[1].toLowerCase() : null;
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
    "definitive edition"
  ];
  return keywords.some(k => text.includes(k));
}

async function main() {
  console.log("\n==================================================");
  console.log("🧠 PHASE 2: COMPREHENSIVE DOMAIN CLASSIFIER");
  console.log("==================================================");

  const backupsDir = path.resolve(process.cwd(), "backups");
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("dedup_snapshot_") && f.endsWith(".json")).sort().reverse();
  const snapshot = JSON.parse(fs.readFileSync(path.join(backupsDir, files[0]), "utf-8"));
  console.log(`📦 Loaded ${snapshot.games.length} games across ${snapshot.totalDuplicateGroups} groups.`);

  // Build link lookup
  const linkMap = new Map<string, PurchaseLink[]>();
  for (const l of snapshot.purchaseLinks) {
    if (!linkMap.has(l.gameId)) linkMap.set(l.gameId, []);
    linkMap.get(l.gameId)!.push(l);
  }

  // Group by title
  const groups = new Map<string, SnapshotGame[]>();
  for (const g of snapshot.games) {
    const key = normalizeTitle(g.title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }

  // Pools
  const poolA_merges: Array<{ primary: SnapshotGame; secondaries: SnapshotGame[]; reason: string }> = [];
  const poolB_protected: Array<{ reason: string; games: SnapshotGame[] }> = [];
  const poolC_ambiguous: Array<{ title: string; games: SnapshotGame[]; reason: string }> = [];

  for (const [normTitle, games] of groups.entries()) {
    if (games.length < 2) continue;

    // Attach links, years, creators
    for (const g of games) {
      g.links = linkMap.get(g.id) || [];
      g.storeIds = g.links.map(l => extractStoreId(l.url)).filter(Boolean);
      g.itchCreators = g.links.map(l => extractItchCreator(l.url)).filter(Boolean);
      g.year = parseYear(g.releaseDate);
      g.isRemake = hasRemakeKeywords(g);
    }

    // ── SUB-CASE 1: ALL-ITCH GROUPS ──
    const allItch = games.every(g => g.slug.startsWith("itch-"));
    if (allItch) {
      // Group games by their itch creator
      const byCreator = new Map<string, SnapshotGame[]>();
      const unknownCreator: SnapshotGame[] = [];

      for (const g of games) {
        const creator = g.itchCreators[0] || (g.developerNames && g.developerNames.toLowerCase() !== "independent creator" ? g.developerNames.toLowerCase() : null);
        if (creator) {
          if (!byCreator.has(creator)) byCreator.set(creator, []);
          byCreator.get(creator)!.push(g);
        } else {
          unknownCreator.push(g);
        }
      }

      // Check for same-creator duplicates
      for (const [creator, creatorGames] of byCreator.entries()) {
        if (creatorGames.length >= 2) {
          // Richest game is primary
          creatorGames.sort((a, b) => (b.summary?.length || 0) - (a.summary?.length || 0));
          poolA_merges.push({
            primary: creatorGames[0],
            secondaries: creatorGames.slice(1),
            reason: `Duplicate Itch uploads by same creator (${creator})`
          });
        }
      }

      // If there are different creators, protect them as distinct games!
      if (byCreator.size > 1) {
        poolB_protected.push({
          reason: `Distinct Itch indie games sharing common title (Creators: ${Array.from(byCreator.keys()).join(", ")})`,
          games
        });
      }

      // Unknown creators with same title
      if (unknownCreator.length > 0 && byCreator.size === 0) {
        poolC_ambiguous.push({
          title: games[0].title,
          games: unknownCreator,
          reason: "Itch games with unverified creators sharing same title"
        });
      }
      continue;
    }

    // ── SUB-CASE 2: CROSS-STORE ITCH + MAIN (e.g. Faith, Slide in the woods) ──
    const itchGames = games.filter(g => g.slug.startsWith("itch-"));
    const mainGames = games.filter(g => !g.slug.startsWith("itch-"));

    if (itchGames.length > 0 && mainGames.length > 0) {
      let matchedAny = false;
      for (const ig of itchGames) {
        const itchCreator = ig.itchCreators[0] || ig.developerNames;
        for (const mg of mainGames) {
          const devMatch = itchCreator && mg.developerNames && haveDevOverlap(itchCreator, mg.developerNames);
          const slugMatch = ig.slug.replace(/^itch-/, "") === mg.slug;
          
          if ((devMatch || slugMatch) && !mg.isRemake && !ig.isRemake) {
            poolA_merges.push({
              primary: mg,
              secondaries: [ig],
              reason: `Cross-store match: Main IGDB/Steam listing unified with Itch release (${mg.developerNames})`
            });
            matchedAny = true;
          }
        }
      }

      if (!matchedAny) {
        poolC_ambiguous.push({
          title: games[0].title,
          games,
          reason: "Cross-store candidates with unconfirmed developer match"
        });
      }
      continue;
    }

    // ── SUB-CASE 3: NON-ITCH (IGDB / STEAM / GOG) ──
    // Build adjacency for safe merges (same dev, close year, no remake keyword)
    const adj: number[][] = Array.from({ length: games.length }, () => []);
    for (let i = 0; i < games.length; i++) {
      for (let j = i + 1; j < games.length; j++) {
        const g1 = games[i];
        const g2 = games[j];
        const devOverlap = haveDevOverlap(g1.developerNames || "", g2.developerNames || "");
        const yearGap = (g1.year && g2.year) ? Math.abs(g1.year - g2.year) : 0;
        const sharedStore = g1.storeIds.some((id: string) => g2.storeIds.includes(id));
        const remakeConflict = (g1.isRemake !== g2.isRemake) || (yearGap >= 4);

        if ((devOverlap || sharedStore) && !remakeConflict) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    // Find connected components
    const visited = new Set<number>();
    const components: SnapshotGame[][] = [];
    for (let i = 0; i < games.length; i++) {
      if (visited.has(i)) continue;
      const comp: SnapshotGame[] = [];
      const queue = [i];
      visited.add(i);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(games[curr]);
        for (const n of adj[curr]) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
      components.push(comp);
    }

    for (const comp of components) {
      if (comp.length >= 2) {
        // Sort to pick richest Golden Record
        comp.sort((a, b) => {
          const score = (g: SnapshotGame) =>
            (g.coverUrl ? 20 : 0) +
            (g.summary && g.summary.length > 30 ? 20 : 0) +
            (g.scareRating !== null ? 25 : 0) +
            (g.links.length > 0 ? 15 : 0) +
            (g.developerNames ? 10 : 0) +
            (g.source === "igdb" || g.source === "steam" ? 10 : 0);
          return score(b) - score(a);
        });

        poolA_merges.push({
          primary: comp[0],
          secondaries: comp.slice(1),
          reason: `Safe multi-store consolidation (${comp[0].developerNames || 'Verified'})`
        });
      } else {
        // Check if single node was kept separate due to Remake / Distinct Dev
        const singleGame = comp[0];
        if (singleGame.isRemake || singleGame.year) {
          poolB_protected.push({
            reason: `Remake/Remaster or distinct release protected (${singleGame.developerNames} [${singleGame.year || 'N/A'}])`,
            games: [singleGame]
          });
        } else {
          poolC_ambiguous.push({
            title: games[0].title,
            games: [singleGame],
            reason: "Non-itch listing with ambiguous developer info"
          });
        }
      }
    }
  }

  // Save results
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pipeline/data");
  fs.writeFileSync(path.join(dataDir, "classified_pool_a.json"), JSON.stringify(poolA_merges, null, 2));
  fs.writeFileSync(path.join(dataDir, "classified_pool_b.json"), JSON.stringify(poolB_protected, null, 2));
  fs.writeFileSync(path.join(dataDir, "classified_pool_c.json"), JSON.stringify(poolC_ambiguous, null, 2));

  console.log(`\n==================================================`);
  console.log(`📊 FINAL CLASSIFICATION RESULTS`);
  console.log(`==================================================`);
  console.log(`🟢 Pool A (Safe Auto-Merges):            ${poolA_merges.length} clusters`);
  console.log(`   ↳ Secondary Games to Consolidate:     ${poolA_merges.reduce((s, m) => s + m.secondaries.length, 0)} games`);
  console.log(`🔴 Pool B (Protected Remakes/Homonyms):  ${poolB_protected.length} groups`);
  console.log(`🟡 Pool C (Ambiguous -> Gemini 2.5):     ${poolC_ambiguous.length} groups`);
  console.log(`==================================================\n`);

  console.log(`📋 Sample Pool A Merges:`);
  poolA_merges.slice(0, 10).forEach((m, i) => {
    console.log(`  [${i + 1}] Primary: "${m.primary.title}" (${m.primary.slug}) [${m.primary.developerNames}]`);
    m.secondaries.forEach(s => console.log(`      ↳ Merges: "${s.title}" (${s.slug}) [${s.developerNames}]`));
    console.log(`      Reason: ${m.reason}\n`);
  });

  console.log(`🛡️ Sample Pool B Protected:`);
  poolB_protected.slice(0, 5).forEach((b, i) => {
    console.log(`  [${i + 1}] ${b.reason}`);
  });
}

main().catch(err => {
  console.error("❌ Classification failed:", err);
  process.exit(1);
});
