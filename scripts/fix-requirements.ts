import "./load-env";
import { turso, schema, eq, isNull, or, like } from "./db-helper";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSteamGameDetails(appId: string): Promise<any | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data[appId] && data[appId].success) {
      return data[appId].data;
    }
  } catch (err) {
    console.error(`⚠️ Failed to fetch Steam details for App ID ${appId}:`, err);
  }
  return null;
}

async function searchSteamAppId(title: string): Promise<string | null> {
  // Normalize title for search
  const cleanTitle = title.replace(/\b(lenticular|deluxe|goty|collector's|standard|ultimate|definitive)\s+edition\b/gi, "").trim();
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanTitle)}&l=english&cc=US`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.items && data.items.length > 0) {
        // Find best match (case-insensitive title comparison)
        const match = data.items.find(
          (item: any) => item.name.toLowerCase() === title.toLowerCase() ||
                         item.name.toLowerCase() === cleanTitle.toLowerCase() ||
                         title.toLowerCase().includes(item.name.toLowerCase())
        ) || data.items[0]; // fallback to first result if no exact match
        
        if (match && match.id) {
          return match.id.toString();
        }
      }
    }
  } catch (err) {
    console.error(`⚠️ Steam search failed for "${title}":`, err);
  }
  return null;
}

async function fetchRawgGameDetails(title: string, apiKey: string): Promise<{ min: string | null; rec: string | null } | null> {
  try {
    const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const searchData = await res.json() as any;
      const bestMatch = searchData.results?.[0];
      if (bestMatch) {
        const detailUrl = `https://api.rawg.io/api/games/${bestMatch.id}?key=${apiKey}`;
        const detailRes = await fetch(detailUrl);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const pcPlatform = detailData.platforms?.find((p: any) => p.platform?.slug === "pc");
          const requirements = pcPlatform?.requirements_en || pcPlatform?.requirements || null;
          return {
            min: requirements?.minimum || null,
            rec: requirements?.recommended || null
          };
        }
      }
    }
  } catch (err) {
    console.error(`⚠️ RAWG fetch failed for "${title}":`, err);
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const steamOnly = args.includes("--steam-only");

  let limit = 50;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) limit = parsedLimit;
  }

  let queryFilter: string | null = null;
  const queryIndex = args.indexOf("--query");
  if (queryIndex !== -1 && args[queryIndex + 1]) {
    queryFilter = args[queryIndex + 1];
  }

  let slugFilter: string | null = null;
  const slugIndex = args.indexOf("--slug");
  if (slugIndex !== -1 && args[slugIndex + 1]) {
    slugFilter = args[slugIndex + 1];
  }

  const rawgApiKey = process.env.RAWG_API_KEY;

  console.log(`\n==================================================`);
  console.log(`🔧 PC SYSTEM REQUIREMENTS SPECIFICATIONS FIXER`);
  console.log(`==================================================`);
  console.log(`🎯 Limit: ${limit} games`);
  console.log(`⚡ Force Re-fetch: ${force ? "YES" : "NO"}`);
  console.log(`🌐 Steam-Only: ${steamOnly ? "YES" : "NO"}`);
  if (queryFilter) console.log(`🔍 Query Filter: "${queryFilter}"`);
  if (slugFilter) console.log(`🔗 Slug Filter: "${slugFilter}"`);
  console.log(`🔑 RAWG API Key: ${rawgApiKey ? "Present in .env" : "None (Steam only)"}`);
  console.log(`==================================================\n`);

  // Build where conditions
  const conditions = [];

  if (!force) {
    conditions.push(
      or(
        isNull(schema.games.minRequirements),
        isNull(schema.games.recRequirements),
        eq(schema.games.minRequirements, ""),
        eq(schema.games.recRequirements, "")
      )
    );
  }

  if (queryFilter) {
    conditions.push(like(schema.games.title, `%${queryFilter}%`));
  }

  if (slugFilter) {
    conditions.push(eq(schema.games.slug, slugFilter));
  }

  // Query games
  let gamesQuery = turso
    .select({
      id: schema.games.id,
      title: schema.games.title,
      slug: schema.games.slug,
      minRequirements: schema.games.minRequirements,
      recRequirements: schema.games.recRequirements
    })
    .from(schema.games);

  if (conditions.length > 0) {
    const { and } = await import("./db-helper");
    gamesQuery = gamesQuery.where(and(...conditions)) as any;
  }

  const gamesToProcess = await gamesQuery.limit(limit);

  console.log(`🔍 Found ${gamesToProcess.length} games to inspect/update.`);
  if (gamesToProcess.length === 0) {
    console.log("🎉 All matching games already have system requirements populated! Nothing to fix.");
    return;
  }

  let updatedCount = 0;

  for (let i = 0; i < gamesToProcess.length; i++) {
    const game = gamesToProcess[i];
    console.log(`\n[${i + 1}/${gamesToProcess.length}] 🎮 Inspecting specs for: "${game.title}"...`);

    let minRequirements: string | null = null;
    let recRequirements: string | null = null;

    // 1. Try to find Steam App ID from purchaseLinks
    const purchaseLinks = await turso
      .select()
      .from(schema.purchaseLinks)
      .where(eq(schema.purchaseLinks.gameId, game.id));

    const steamLink = purchaseLinks.find(
      (link) => link.storeName.toLowerCase() === "steam" || link.url.includes("store.steampowered.com")
    );

    let appId: string | null = null;
    if (steamLink) {
      const match = steamLink.url.match(/\/app\/(\d+)/);
      if (match) {
        appId = match[1];
        console.log(`  🔗 Found Steam App ID from purchase links: ${appId}`);
      }
    }

    // 2. If no Steam App ID, search on Steam by title
    if (!appId) {
      console.log(`  🔍 No Steam purchase link. Searching Steam by title...`);
      appId = await searchSteamAppId(game.title);
      if (appId) {
        console.log(`  🎯 Steam search resolved to App ID: ${appId}`);
      }
    }

    // 3. Query Steam details for requirements
    if (appId) {
      console.log(`  📡 Querying Steam Store API for App ID ${appId}...`);
      const steamData = await fetchSteamGameDetails(appId);
      if (steamData && steamData.pc_requirements) {
        minRequirements = steamData.pc_requirements.minimum || null;
        recRequirements = steamData.pc_requirements.recommended || null;

        if (minRequirements || recRequirements) {
          console.log(`  ✅ Successfully retrieved requirements from Steam API.`);
        }
      }
      await sleep(1500); // Be polite to Steam API
    }

    // 4. Fallback to RAWG if Steam failed and RAWG is allowed
    if ((!minRequirements && !recRequirements) && !steamOnly && rawgApiKey) {
      console.log(`  🌐 Fallback: Querying RAWG API for "${game.title}"...`);
      const rawgData = await fetchRawgGameDetails(game.title, rawgApiKey);
      if (rawgData) {
        minRequirements = rawgData.min;
        recRequirements = rawgData.rec;
        if (minRequirements || recRequirements) {
          console.log(`  ✅ Successfully retrieved requirements from RAWG API.`);
        }
      }
      await sleep(1500); // Be polite to RAWG API
    }

    // 5. Update Database if any requirements found
    if (minRequirements || recRequirements) {
      await turso
        .update(schema.games)
        .set({
          minRequirements,
          recRequirements
        })
        .where(eq(schema.games.id, game.id));
      
      console.log(`  💾 Saved requirements to database.`);
      updatedCount++;
    } else {
      console.log(`  ❌ No system requirements found on Steam or RAWG for this game.`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 Fix Completed! Updated specs for ${updatedCount}/${gamesToProcess.length} games.`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Fatal Error in fixer script:", err);
  process.exit(1);
});
