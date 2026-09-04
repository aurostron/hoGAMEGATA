import * as fs from "fs";
import * as path from "path";

function normalizeAlpha(str: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseYear(d: any) {
  if (!d) return "Unknown";
  const ms = d < 1e11 ? d * 1000 : d;
  const y = new Date(ms).getFullYear();
  return (y >= 1970 && y <= 2035) ? y : "Unknown";
}

function main() {
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pass2/data");
  const poolA = JSON.parse(fs.readFileSync(path.join(dataDir, "audit_pool_a.json"), "utf-8"));
  const poolC = JSON.parse(fs.readFileSync(path.join(dataDir, "audit_pool_c.json"), "utf-8"));

  const backupsDir = path.resolve(process.cwd(), "backups/pass2");
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("snapshot_pass2_") && f.endsWith(".json")).sort().reverse();
  const snapshot = JSON.parse(fs.readFileSync(path.join(backupsDir, files[0]), "utf-8"));

  // Map of all active games by normalized alphanumeric title
  const allByTitle = new Map<string, any[]>();
  for (const g of snapshot.candidateGames) {
    const key = normalizeAlpha(g.title);
    if (key.length > 2) {
      if (!allByTitle.has(key)) allByTitle.set(key, []);
      allByTitle.get(key)!.push(g);
    }
  }

  // 1. Filter out "+" or edition items from Pool A to double-check with Gemini
  const safePoolA: any[] = [];
  const doubleCheckFromPoolA: any[] = [];

  for (const item of poolA) {
    const pTitle = item.primary.title.toLowerCase();
    const sTitle = item.secondaries[0].title.toLowerCase();
    const hasPlusOrDiff = pTitle.includes("+") !== sTitle.includes("+") || pTitle.includes("director") !== sTitle.includes("director");

    if (hasPlusOrDiff) {
      doubleCheckFromPoolA.push({
        title: item.primary.title,
        games: [item.primary, ...item.secondaries]
      });
    } else {
      safePoolA.push(item);
    }
  }

  // Save refined Pool A
  fs.writeFileSync(path.join(dataDir, "refined_pool_a.json"), JSON.stringify(safePoolA, null, 2), "utf-8");

  // 2. Aggregate Pool C candidates by title
  const poolCGroups = new Map<string, any[]>();
  for (const c of poolC) {
    const key = normalizeAlpha(c.title);
    if (!poolCGroups.has(key)) poolCGroups.set(key, []);
    c.games.forEach((g: any) => {
      if (!poolCGroups.get(key)!.some((x: any) => x.id === g.id)) {
        poolCGroups.get(key)!.push(g);
      }
    });
  }

  // Also match against full title cluster peers
  const arbTasks: any[] = [];
  let taskId = 1;

  // Add the "+" double checks from Pool A
  for (const item of doubleCheckFromPoolA) {
    arbTasks.push({
      id: taskId++,
      title: item.title,
      source: "Pool A '+' Edition / Expansion Review",
      games: item.games.map((g: any) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        developer: g.developerNames || "Unknown",
        year: parseYear(g.releaseDate),
        platforms: g.platformNames || "Unknown",
        summary: (g.summary || "").slice(0, 150)
      }))
    });
  }

  // Add Pool C multi-game clusters
  for (const [key, clusterGames] of poolCGroups.entries()) {
    // If cluster has 1 game, check if other games in DB share the key
    const allMatchingInDb = allByTitle.get(key) || [];
    const combinedGames = [...clusterGames];
    for (const dbGame of allMatchingInDb) {
      if (!combinedGames.some(x => x.id === dbGame.id)) {
        combinedGames.push(dbGame);
      }
    }

    if (combinedGames.length >= 2) {
      arbTasks.push({
        id: taskId++,
        title: combinedGames[0].title,
        source: "Pool C Ambiguous Review",
        games: combinedGames.map((g: any) => ({
          id: g.id,
          slug: g.slug,
          title: g.title,
          developer: g.developerNames || "Unknown",
          year: parseYear(g.releaseDate),
          platforms: g.platformNames || "Unknown",
          summary: (g.summary || "").slice(0, 150)
        }))
      });
    }
  }

  fs.writeFileSync(path.join(dataDir, "arb_tasks.json"), JSON.stringify(arbTasks, null, 2), "utf-8");

  console.log(`\n==================================================`);
  console.log(`📋 PASS 2: ARBITRATION TASKS PREPARED`);
  console.log(`==================================================`);
  console.log(`🟢 Refined Safe Pool A Merges:           ${safePoolA.length} clusters`);
  console.log(`🟡 Total Deep Tasks for Gemini 2.5 Flash: ${arbTasks.length} tasks`);
  console.log(`==================================================\n`);
}

main();
