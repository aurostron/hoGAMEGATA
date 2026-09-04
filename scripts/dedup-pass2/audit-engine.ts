import * as fs from "fs";
import * as path from "path";

interface CandidateGame {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  coverUrl: string | null;
  releaseDate: number | null;
  developerNames: string | null;
  platformNames: string | null;
  scareRating: number | null;
  source: string | null;
  [key: string]: any;
}

interface PurchaseLink {
  id: string;
  gameId: string;
  storeName: string;
  url: string;
}

function normalizeAlpha(str: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
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
  if (devStrA.toLowerCase() === "independent creator" || devStrB.toLowerCase() === "independent creator") {
    return false;
  }
  const tokA = tokenize(devStrA);
  const tokB = tokenize(devStrB);
  if (tokA.length === 0 || tokB.length === 0) return false;
  return tokA.some(t => tokB.includes(t));
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
  const itchMatch = url.match(/https?:\/\/([a-z0-9-_]+\.itch\.io\/[a-z0-9-_]+)/i);
  if (itchMatch) return `itch:${itchMatch[1].toLowerCase()}`;
  return null;
}

function isDemoOrPrologue(g: CandidateGame): boolean {
  const text = `${g.title} ${g.slug}`.toLowerCase();
  const keywords = ["demo", "prologue", "trial", "teaser", "chapter 1", "episode 1", "preview"];
  return keywords.some(k => new RegExp(`\\b${k}\\b`, "i").test(text));
}

function hasRemakeSignal(g: CandidateGame): boolean {
  const text = `${g.title} ${g.slug} ${g.summary || ""} ${g.storyline || ""}`.toLowerCase();
  const keywords = ["remake", "reimagining", "re-imagining", "ground-up", "hd collection", "remaster", "remastered", "reboot"];
  return keywords.some(k => text.includes(k));
}

async function main() {
  console.log("\n==================================================");
  console.log("🔬 PASS 2: 5-POINT VERIFICATION AUDIT ENGINE");
  console.log("==================================================");

  const backupsDir = path.resolve(process.cwd(), "backups/pass2");
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("snapshot_pass2_") && f.endsWith(".json")).sort().reverse();
  if (files.length === 0) {
    console.error("❌ No Pass 2 snapshot found!");
    process.exit(1);
  }
  const snapshotPath = path.join(backupsDir, files[0]);
  console.log(`📂 Loading snapshot from: ${snapshotPath}`);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));

  console.log(`📦 Loaded ${snapshot.candidateGames.length} candidate games.`);

  // Build link lookup
  const linksByGame = new Map<string, PurchaseLink[]>();
  for (const l of snapshot.purchaseLinks) {
    const gid = String(l.gameId);
    if (!linksByGame.has(gid)) linksByGame.set(gid, []);
    linksByGame.get(gid)!.push(l);
  }

  // Group candidate games by:
  // 1. Alphanumeric title (catches punctuation differences)
  // 2. Or shared store ID
  const games: CandidateGame[] = snapshot.candidateGames;
  for (const g of games) {
    g.links = linksByGame.get(String(g.id)) || [];
    g.storeIds = g.links.map(l => extractStoreId(l.url)).filter(Boolean);
    g.itchCreators = g.links.map(l => extractItchCreator(l.url)).filter(Boolean);
    g.year = parseYear(g.releaseDate);
    g.isDemo = isDemoOrPrologue(g);
    g.isRemake = hasRemakeSignal(g);
  }

  // Cluster by normalized alphanumeric title
  const clustersByTitle = new Map<string, CandidateGame[]>();
  for (const g of games) {
    const key = normalizeAlpha(g.title);
    if (key.length > 2) {
      if (!clustersByTitle.has(key)) clustersByTitle.set(key, []);
      clustersByTitle.get(key)!.push(g);
    }
  }

  const poolA_candidates: any[] = [];
  const poolB_protected: any[] = [];
  const poolC_ambiguous: any[] = [];

  for (const [normTitle, group] of clustersByTitle.entries()) {
    if (group.length < 2) continue;

    // ── STRICT POINT 3: DEMO VS FULL GAME GUARD ──
    const demos = group.filter(g => g.isDemo);
    const fullGames = group.filter(g => !g.isDemo);
    if (demos.length > 0 && fullGames.length > 0) {
      poolB_protected.push({
        reason: "Demo/Prologue vs Full Game Guard: Standalone demo records preserved separately",
        games: group
      });
      continue;
    }

    // ── STRICT POINT 5: ITCH CREATOR SUBDOMAIN ISOLATION ──
    const allItch = group.every(g => g.slug.startsWith("itch-"));
    if (allItch) {
      const byCreator = new Map<string, CandidateGame[]>();
      for (const g of group) {
        const creator = g.itchCreators[0] || (g.developerNames && g.developerNames.toLowerCase() !== "independent creator" ? g.developerNames.toLowerCase() : null);
        if (creator) {
          if (!byCreator.has(creator)) byCreator.set(creator, []);
          byCreator.get(creator)!.push(g);
        }
      }

      // If different creators exist, protect all of them!
      if (byCreator.size > 1) {
        poolB_protected.push({
          reason: `Distinct Itch indie games by different creators (${Array.from(byCreator.keys()).join(", ")})`,
          games: group
        });
        continue;
      }

      // If same creator uploaded multiple listings:
      for (const [creator, creatorGames] of byCreator.entries()) {
        if (creatorGames.length >= 2) {
          creatorGames.sort((a, b) => (b.summary?.length || 0) - (a.summary?.length || 0));
          poolA_candidates.push({
            primary: creatorGames[0],
            secondaries: creatorGames.slice(1),
            reason: `Duplicate Itch uploads by same creator (${creator})`
          });
        }
      }
      continue;
    }

    // ── STRICT POINT 1 & 2: CROSS-STORE & STUDIO PEDIGREE ──
    const itchGames = group.filter(g => g.slug.startsWith("itch-"));
    const mainGames = group.filter(g => !g.slug.startsWith("itch-"));

    if (itchGames.length > 0 && mainGames.length > 0) {
      let matchedAny = false;
      for (const ig of itchGames) {
        const itchCreator = ig.itchCreators[0] || ig.developerNames;
        for (const mg of mainGames) {
          const devMatch = itchCreator && mg.developerNames && haveDevOverlap(itchCreator, mg.developerNames);
          const slugMatch = ig.slug.replace(/^itch-/, "") === mg.slug;
          
          if ((devMatch || slugMatch) && !mg.isRemake && !ig.isRemake) {
            poolA_candidates.push({
              primary: mg,
              secondaries: [ig],
              reason: `Cross-store verified match (${mg.developerNames})`
            });
            matchedAny = true;
          }
        }
      }

      if (!matchedAny) {
        poolC_ambiguous.push({
          title: group[0].title,
          games: group,
          reason: "Cross-store candidate with unconfirmed creator match"
        });
      }
      continue;
    }

    // ── STRICT POINT 4: NON-ITCH (IGDB / STEAM / GOG) ──
    const years = group.map(g => g.year).filter((y): y is number => y !== null);
    const minYear = years.length > 0 ? Math.min(...years) : null;
    const maxYear = years.length > 0 ? Math.max(...years) : null;
    const yearGap = (minYear !== null && maxYear !== null) ? maxYear - minYear : 0;
    const anyRemake = group.some(g => g.isRemake);

    // Build connected components for safe merges
    const adj: number[][] = Array.from({ length: group.length }, () => []);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const g1 = group[i];
        const g2 = group[j];
        const devOverlap = haveDevOverlap(g1.developerNames || "", g2.developerNames || "");
        const sharedStore = g1.storeIds.some((id: string) => g2.storeIds.includes(id));
        const gap = (g1.year && g2.year) ? Math.abs(g1.year - g2.year) : 0;

        if ((devOverlap || sharedStore) && gap <= 2 && !g1.isRemake && !g2.isRemake) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    const visited = new Set<number>();
    for (let i = 0; i < group.length; i++) {
      if (visited.has(i)) continue;
      const comp: CandidateGame[] = [];
      const queue = [i];
      visited.add(i);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(group[curr]);
        for (const n of adj[curr]) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }

      if (comp.length >= 2) {
        comp.sort((a, b) => {
          const score = (g: CandidateGame) =>
            (g.coverUrl ? 20 : 0) +
            (g.summary && g.summary.length > 30 ? 20 : 0) +
            (g.scareRating !== null ? 25 : 0) +
            (g.links.length > 0 ? 15 : 0) +
            (g.developerNames ? 10 : 0);
          return score(b) - score(a);
        });

        poolA_candidates.push({
          primary: comp[0],
          secondaries: comp.slice(1),
          reason: `Verified deterministic match (${comp[0].developerNames})`
        });
      } else {
        const single = comp[0];
        if (single.isRemake || yearGap >= 3) {
          poolB_protected.push({
            reason: `Remake/Generational era protection (${single.developerNames || 'Unknown'} [${single.year || 'N/A'}])`,
            games: [single]
          });
        } else {
          poolC_ambiguous.push({
            title: group[0].title,
            games: [single],
            reason: "Ambiguous studio or metadata discrepancy"
          });
        }
      }
    }
  }

  // Save audit data
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pass2/data");
  fs.writeFileSync(path.join(dataDir, "audit_pool_a.json"), JSON.stringify(poolA_candidates, null, 2));
  fs.writeFileSync(path.join(dataDir, "audit_pool_b.json"), JSON.stringify(poolB_protected, null, 2));
  fs.writeFileSync(path.join(dataDir, "audit_pool_c.json"), JSON.stringify(poolC_ambiguous, null, 2));

  console.log(`\n==================================================`);
  console.log(`📊 PASS 2 AUDIT ENGINE RESULTS`);
  console.log(`==================================================`);
  console.log(`🟢 Pool A (Safe Duplicate Candidates):  ${poolA_candidates.length} clusters (${poolA_candidates.reduce((s, c) => s + c.secondaries.length, 0)} games)`);
  console.log(`🔴 Pool B (Strictly Protected Records):  ${poolB_protected.length} groups`);
  console.log(`🟡 Pool C (Ambiguous -> Deep AI Review): ${poolC_ambiguous.length} groups`);
  console.log(`==================================================\n`);

  if (poolA_candidates.length > 0) {
    console.log(`📋 Sample Pool A Candidates:`);
    poolA_candidates.slice(0, 5).forEach((c, i) => {
      console.log(`  [${i + 1}] Primary: "${c.primary.title}" (${c.primary.slug}) [${c.primary.developerNames}]`);
      c.secondaries.forEach((s: any) => console.log(`      ↳ Secondary: "${s.title}" (${s.slug}) [${s.developerNames}]`));
      console.log(`      Reason: ${c.reason}\n`);
    });
  }

  console.log(`🛡️ Sample Pool B Protected:`);
  poolB_protected.slice(0, 5).forEach((b, i) => {
    console.log(`  [${i + 1}] ${b.reason}`);
  });
}

main().catch(err => {
  console.error("❌ Audit engine failed:", err);
  process.exit(1);
});
