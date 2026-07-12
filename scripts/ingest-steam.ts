import "./load-env";
import {
  turso,
  schema,
  eq,
  getOrCreateGenre,
  getOrCreatePlatform,
  getOrCreateDeveloper,
  getOrCreatePublisher,
  saveGame,
  savePriceSnapshot
} from "./db-helper";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

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
    console.error(`⚠️ Failed to fetch app details for App ID ${appId}:`, err);
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const forceUpdate = args.includes("--force-update");

  let targetLimit = 50;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      targetLimit = parsedLimit;
    }
  }

  let skipDesc = false;
  const skipDescIndex = args.indexOf("--skip-desc");
  if (skipDescIndex !== -1) {
    skipDesc = true;
  }

  console.log(`🚀 Starting Steam Ingestion...`);
  console.log(`🎯 Limit: ${targetLimit} games`);
  console.log(`🔍 Dry Run: ${dryRun ? "YES" : "NO"}`);
  console.log(`⚡ Force Update: ${forceUpdate ? "YES" : "NO"}`);

  const horrorGenreId = await getOrCreateGenre("Horror", "horror");

  let offset = 0;
  const pageSize = 50;
  let gamesProcessed = 0;

  while (gamesProcessed < targetLimit) {
    console.log(`\n📡 Fetching games from Steam Store (Offset: ${offset}, Page Size: ${pageSize})...`);
    // Querying steam tags for horror-themed games:
    // 1667 = Horror, 3978 = Survival Horror, 1721 = Psychological Horror
    const searchUrl = `https://store.steampowered.com/search/results/?query&start=${offset}&count=${pageSize}&tags=1667&cc=US&l=english`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    if (!response.ok) {
      console.error(`❌ Steam search failed with status: ${response.status}`);
      break;
    }

    const html = await response.text();
    const rowRegex = /<a\s+[^>]*?href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/([^/"]+)\/[^>]*?>/g;
    let match;
    const candidates: Array<{ appId: string; rawSlug: string; tagIds: number[] }> = [];

    while ((match = rowRegex.exec(html)) !== null) {
      const fullTag = match[0];
      const appId = match[1];
      const rawSlug = match[2];

      const tagIdsMatch = fullTag.match(/data-ds-tagids="\[([\d,]*?)\]"/);
      const tagIds = tagIdsMatch && tagIdsMatch[1]
        ? tagIdsMatch[1].split(",").map(id => parseInt(id.trim(), 10))
        : [];

      candidates.push({ appId, rawSlug, tagIds });
    }

    if (candidates.length === 0) {
      console.log("🏁 No more candidates found in Steam search results.");
      break;
    }

    console.log(`📚 Found ${candidates.length} games on search offset ${offset}. Ingesting...`);

    for (const c of candidates) {
      const appId = c.appId;
      const slug = c.rawSlug.toLowerCase().replace(/_/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const tagIds = c.tagIds;
      const storeLink = `https://store.steampowered.com/app/${appId}/`;

      const PRIMARY_HORROR_TAGS = [
        1667, // Horror
        3978, // Survival Horror
        1721, // Psychological Horror
        5094  // Lovecraftian
      ];

      const hasPrimaryHorror = tagIds.some(id => PRIMARY_HORROR_TAGS.includes(id));
      if (!hasPrimaryHorror) {
        console.log(`⏩ Skipping candidate App ID ${appId} (${slug}): "Horror" is not in its top tags.`);
        continue;
      }

      const STRICT_HORROR_TAGS = [
        3978, // Survival Horror
        1721  // Psychological Horror
      ];

      const BLACKLISTED_ACTION_TAGS = [
        1774, // Shooter
        1663, // FPS
        1773, // Arcade
        3810, // Third-Person Shooter
        4255, // Shoot 'Em Up
        701,  // Sports
        699,  // Racing
        1743, // Fighting
        1643  // Hack and Slash
      ];

      const hasBlacklisted = tagIds.some(id => BLACKLISTED_ACTION_TAGS.includes(id));
      if (hasBlacklisted) {
        const hasStrictHorror = tagIds.some(id => STRICT_HORROR_TAGS.includes(id));
        if (!hasStrictHorror) {
          console.log(`⏩ Skipping candidate App ID ${appId} (${slug}): Has blacklisted tag(s) without strict survival/psychological horror tags.`);
          continue;
        }
      }

      console.log(`\n🎮 Scanning Steam candidate: App ID ${appId} (slug: ${slug})`);

      let existingGame: any = null;
      if (!dryRun) {
        const [bySlug] = await turso
          .select()
          .from(schema.games)
          .where(eq(schema.games.slug, slug))
          .limit(1);
        if (bySlug) {
          existingGame = bySlug;
        } else {
          const [byLink] = await turso
            .select({ gameId: schema.purchaseLinks.gameId })
            .from(schema.purchaseLinks)
            .where(eq(schema.purchaseLinks.url, storeLink))
            .limit(1);
          if (byLink) {
            const [game] = await turso
              .select()
              .from(schema.games)
              .where(eq(schema.games.id, byLink.gameId))
              .limit(1);
            existingGame = game;
          }
        }
      }

      let appData = null;
      if (!existingGame || forceUpdate) {
        if (!skipDesc) {
          console.log(`📥 Fetching detailed appdetails from Steam for App ID ${appId}...`);
          appData = await fetchSteamGameDetails(appId);
          await sleep(1500);
        }
      } else {
        console.log(`⏩ Game already exists in DB. Skipping detailed appdetails fetch.`);
      }

      if (!existingGame && skipDesc && !appData) {
        appData = {
          name: slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          short_description: "Horror game from Steam Catalog Ingestion.",
          platforms: { windows: true },
          genres: [{ description: "Horror" }],
          developers: ["Unknown Developer"],
          publishers: ["Unknown Publisher"]
        };
      }

      if (!appData && (!existingGame || forceUpdate)) {
        console.warn(`⚠️ Skipping: could not fetch details for App ID ${appId} from Steam API`);
        continue;
      }

      if (dryRun) {
        console.log(`ℹ️ [DRY RUN] Would save game: ${appData ? appData.name : slug}`);
        gamesProcessed++;
        if (gamesProcessed >= targetLimit) break;
        continue;
      }

      let savedGameId = "";
      if (appData) {
        const title = appData.name;
        const summary = appData.short_description ? stripHtml(appData.short_description) : null;
        const coverUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
        
        const screenshots: string[] = [];
        if (appData.screenshots) {
          for (const s of appData.screenshots) {
            if (s.path_full) screenshots.push(s.path_full);
          }
        }

        let releaseDate = null;
        if (appData.release_date && !appData.release_date.coming_soon && appData.release_date.date) {
          try {
            const parsed = new Date(appData.release_date.date);
            if (!isNaN(parsed.getTime())) {
              releaseDate = parsed;
            }
          } catch (e) {
            console.warn(`⚠️ Failed to parse release date: ${appData.release_date.date}`);
          }
        }

        const genreIds: string[] = [];
        if (appData.genres) {
          for (const gen of appData.genres) {
            const genId = await getOrCreateGenre(gen.description, gen.description.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
            genreIds.push(genId);
          }
        }
        if (genreIds.length === 0 && horrorGenreId) {
          genreIds.push(horrorGenreId);
        }

        const developerIds: string[] = [];
        if (appData.developers) {
          for (const devName of appData.developers) {
            const devSlug = devName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const devId = await getOrCreateDeveloper(devName, devSlug);
            developerIds.push(devId);
          }
        }

        const publisherIds: string[] = [];
        if (appData.publishers) {
          for (const pubName of appData.publishers) {
            const pubSlug = pubName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const pubId = await getOrCreatePublisher(pubName, pubSlug);
            publisherIds.push(pubId);
          }
        }

        const platformIds: string[] = [];
        if (appData.platforms) {
          if (appData.platforms.windows) {
            const id = await getOrCreatePlatform("PC (Windows)", "win");
            platformIds.push(id);
          }
          if (appData.platforms.mac) {
            const id = await getOrCreatePlatform("Mac", "mac");
            platformIds.push(id);
          }
          if (appData.platforms.linux) {
            const id = await getOrCreatePlatform("Linux", "linux");
            platformIds.push(id);
          }
        }

        const developerNames = appData.developers?.join(", ") || null;
        const genreNames = appData.genres?.map((g: any) => g.description).join(", ") || "Horror";
        const platformNames = Object.keys(appData.platforms || {})
          .filter(k => appData.platforms[k])
          .map(k => k === "windows" ? "PC (Windows)" : (k === "mac" ? "Mac" : "Linux"))
          .join(", ") || null;

        console.log(`💾 Saving game record in DB...`);
        savedGameId = await saveGame({
          id: existingGame?.id,
          title,
          slug,
          summary: summary || existingGame?.summary,
          coverUrl: coverUrl || existingGame?.coverUrl,
          releaseDate: releaseDate || existingGame?.releaseDate,
          screenshots: screenshots.length > 0 ? screenshots : existingGame?.screenshots,
          developerNames: developerNames || existingGame?.developerNames,
          genreNames: genreNames || existingGame?.genreNames,
          platformNames: platformNames || existingGame?.platformNames,
          source: "steam",
          developerIds,
          publisherIds,
          genreIds,
          platformIds,
          purchaseLinks: [{ storeName: "Steam", url: storeLink }]
        });

        // Add PriceSnapshot
        if (appData.price_overview) {
          const finalPrice = appData.price_overview.final / 100;
          const basePrice = appData.price_overview.initial / 100;
          const discountPercent = appData.price_overview.discount_percent;
          const currency = appData.price_overview.currency || "USD";

          await savePriceSnapshot({
            gameId: savedGameId,
            storeName: "Steam",
            dealPrice: finalPrice,
            retailPrice: basePrice,
            discountPercent,
            dealUrl: storeLink,
            currency,
            country: "US"
          });
        }
      }

      gamesProcessed++;
      if (gamesProcessed >= targetLimit) {
        break;
      }
      
      await sleep(1000);
    }

    offset += pageSize;
    await sleep(2000);
  }

  console.log(`\n✅ Steam Ingestion completed! Successfully processed ${gamesProcessed} games.`);
}

main().catch((err) => {
  console.error("❌ Fatal Ingestion Error:", err);
  process.exit(1);
});
