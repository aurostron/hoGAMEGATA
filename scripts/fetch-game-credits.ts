import "./load-env";
import { turso, schema, eq } from "./db-helper";
import * as readline from "readline";

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

interface TeamMember {
  id: number;
  name: string;
  role: string;
  roles: string[];
  image: string | null;
  rawgSlug: string;
}

async function fetchRawgCredits(rawgSlug: string, apiKey: string): Promise<TeamMember[]> {
  try {
    const teamUrl = `https://api.rawg.io/api/games/${rawgSlug}/development-team?key=${apiKey}`;
    const res = await fetch(teamUrl);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((item: any) => {
      const positions = item.positions?.map((p: any) => p.name) || [];
      return {
        id: item.id,
        name: item.name,
        role: positions[0] || "Contributor",
        roles: positions,
        image: item.image || null,
        rawgSlug: item.slug,
      };
    });
  } catch {
    return [];
  }
}

async function searchRawgGame(title: string, apiKey: string): Promise<string | null> {
  try {
    const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
    const res = await fetch(searchUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.slug || null;
  } catch {
    return null;
  }
}

function printCreditsTable(gameTitle: string, team: TeamMember[]) {
  console.log(`\n==================================================`);
  console.log(`🎬 GAME CREDITS & DEVELOPMENT TEAM: ${gameTitle.toUpperCase()}`);
  console.log(`👥 Total Contributors Found: ${team.length}`);
  console.log(`==================================================`);

  if (team.length === 0) {
    console.log("⚠️ No development credits found on RAWG for this game.");
    console.log(`==================================================\n`);
    return;
  }

  // Format and group by primary role
  const grouped: Record<string, TeamMember[]> = {};
  for (const m of team) {
    const r = m.role || "Other Contributors";
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(m);
  }

  for (const [role, members] of Object.entries(grouped)) {
    console.log(`\n📌 ${role.toUpperCase()} (${members.length}):`);
    for (const m of members) {
      const imageTag = m.image ? ` [Avatar: Yes]` : ``;
      const allRoles = m.roles.length > 1 ? ` (${m.roles.join(", ")})` : "";
      console.log(`  • ${m.name}${allRoles}${imageTag}`);
    }
  }

  console.log(`\n==================================================\n`);
}

async function runSingleGameLookup(titleOrSlug: string, apiKey: string) {
  console.log(`🔍 Searching credits for: "${titleOrSlug}"...`);

  let rawgSlug = titleOrSlug.toLowerCase().trim();
  let team = await fetchRawgCredits(rawgSlug, apiKey);

  if (team.length === 0) {
    const foundSlug = await searchRawgGame(titleOrSlug, apiKey);
    if (foundSlug) {
      console.log(`🎯 Found RAWG match: "${foundSlug}"`);
      team = await fetchRawgCredits(foundSlug, apiKey);
    }
  }

  printCreditsTable(titleOrSlug, team);
}

async function runBatchSync(limit: number, apiKey: string) {
  console.log(`\n🚀 Starting Batch Game Credits Sync (Target limit: ${limit} games)...`);

  // Query games from Turso
  const games = await turso
    .select({
      id: schema.games.id,
      title: schema.games.title,
      slug: schema.games.slug,
      rawgSlug: schema.games.rawgSlug,
      developerNames: schema.games.developerNames,
    })
    .from(schema.games)
    .limit(limit);

  console.log(`🎮 Loaded ${games.length} games to inspect...\n`);

  let fetchedCount = 0;
  let totalContributorsFound = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const targetSlug = game.rawgSlug || game.slug;

    console.log(`[${i + 1}/${games.length}] Processing "${game.title}"...`);
    let team = await fetchRawgCredits(targetSlug, apiKey);

    if (team.length === 0 && game.title) {
      const searchSlug = await searchRawgGame(game.title, apiKey);
      if (searchSlug) {
        team = await fetchRawgCredits(searchSlug, apiKey);
      }
    }

    if (team.length > 0) {
      fetchedCount++;
      totalContributorsFound += team.length;
      console.log(`  └─ ✅ Found ${team.length} contributors.`);
    } else {
      console.log(`  └─ ⚠️ No credits found.`);
    }

    // Rate limiting delay
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n==================================================`);
  console.log(`🎉 BATCH CREDITS SYNC SUMMARY`);
  console.log(`==================================================`);
  console.log(`Games scanned: ${games.length}`);
  console.log(`Games with credits retrieved: ${fetchedCount}`);
  console.log(`Total contributors retrieved: ${totalContributorsFound}`);
  console.log(`==================================================\n`);
}

async function main() {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    console.error("❌ RAWG_API_KEY is not set in environment or .env file.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let titleArg = "";
  let limitArg = 50;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--title" || args[i] === "-t") && args[i + 1]) {
      titleArg = args[i + 1];
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limitArg = parseInt(args[i + 1], 10) || 50;
      i++;
    }
  }

  if (titleArg) {
    await runSingleGameLookup(titleArg, apiKey);
    return;
  }

  // Interactive CLI Menu
  console.log("\n==================================================");
  console.log("🎬 GAME CREDITS & DEVELOPMENT TEAM GETTER");
  console.log("==================================================");
  console.log("1. Get credits for a single game (by title / slug)");
  console.log("2. Batch fetch & report credits for top games in DB");
  console.log("3. Exit");
  console.log("==================================================");

  const choice = await askQuestion("Select option [1-3]: ");

  if (choice === "1") {
    const gameName = await askQuestion("Enter game title or slug (e.g. Visage, Alan Wake 2): ");
    if (gameName.trim()) {
      await runSingleGameLookup(gameName.trim(), apiKey);
    } else {
      console.log("❌ No title entered.");
    }
  } else if (choice === "2") {
    const limitInput = await askQuestion("Enter number of games to scan (default 50): ");
    const lim = parseInt(limitInput, 10) || 50;
    await runBatchSync(lim, apiKey);
  } else {
    console.log("👋 Bye!");
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
});
