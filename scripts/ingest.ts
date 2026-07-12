import "./load-env";
import * as fs from "fs";
import { MOODS, getMoodTagsForGame } from "./mood-rules";
import {
  turso,
  schema,
  eq,
  inArray,
  getOrCreateGenre,
  getOrCreatePlatform,
  getOrCreateDeveloper,
  getOrCreatePublisher,
  getOrCreateTag,
  saveGame,
  generateId
} from "./db-helper";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RawgDetails {
  metacritic: number | null;
  metacriticUrl: string | null;
  playtime: number | null;
  esrbRating: string | null;
  redditUrl: string | null;
  websiteUrl: string | null;
  rawgRating: number | null;
  rawgSlug: string | null;
}

async function fetchRawgGameDetails(
  title: string,
  slug: string,
  apiKey: string
): Promise<RawgDetails | null> {
  const parseRawgData = (data: any): RawgDetails => {
    return {
      metacritic: data.metacritic || null,
      metacriticUrl: data.metacritic_url || null,
      playtime: data.playtime || null,
      esrbRating: data.esrb_rating?.name || null,
      redditUrl: data.reddit_url || null,
      websiteUrl: data.website || null,
      rawgRating: data.rating || null,
      rawgSlug: data.slug || null,
    };
  };

  try {
    const directUrl = `https://api.rawg.io/api/games/${slug}?key=${apiKey}`;
    const directResponse = await fetch(directUrl);
    
    if (directResponse.ok) {
      const data = await directResponse.json();
      return parseRawgData(data);
    }

    console.log(`🔍 RAWG direct slug match failed for '${slug}'. Searching by title '${title}'...`);
    const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
    const searchResponse = await fetch(searchUrl);
    
    if (searchResponse.ok) {
      const searchData = (await searchResponse.json()) as { results?: any[] };
      const bestMatch = searchData.results?.[0];
      
      if (bestMatch) {
        const detailUrl = `https://api.rawg.io/api/games/${bestMatch.id}?key=${apiKey}`;
        const detailResponse = await fetch(detailUrl);
        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          return parseRawgData(detailData);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Failed to fetch RAWG details for '${title}':`, error);
  }

  return null;
}

async function ingestRetroGames() {
  const args = process.argv.slice(2);
  let targetLimit = 200;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      targetLimit = parsedLimit;
    }
  }

  let collection = "";
  const collectionIndex = args.indexOf("--collection");
  if (collectionIndex !== -1 && args[collectionIndex + 1]) {
    collection = args[collectionIndex + 1].trim();
  }

  // Pre-upsert relationships to link them properly
  const horrorGenreId = await getOrCreateGenre("Horror", "horror");
  const classicPlatformId = await getOrCreatePlatform("Classic", "classic");
  const unknownDevId = await getOrCreateDeveloper("Unknown Developer", "unknown-developer");

  let queryUrl = `https://archive.org/advancedsearch.php?output=json&fl=identifier,title,mediatype,format,year,description,licenseurl&rows=${targetLimit}&sort[]=publicdate+desc`;
  if (collection) {
    queryUrl += `&q=subject:(horror)+mediatype:(software)+AND+collection:(${collection})`;
    console.log(`🎯 Targeting collection: ${collection}`);
  } else {
    queryUrl += `&q=subject:(horror)+mediatype:(software)+AND+(collection:(classicgaming)+OR+collection:(classicpcgames)+OR+collection:(softwarelibrary_msdos)+OR+collection:(cdromimages))`;
    console.log(`🎯 Targeting all classic horror collections`);
  }
  console.log(`🎯 Limit: ${targetLimit} games`);

  const sources = [
    { name: 'Archive.org', query: queryUrl },
  ];
  let total = 0;
  for (const source of sources) {
    console.log(`📡 Fetching from ${source.name}...`);
    try {
      const resp = await fetch(source.query);
      if (!resp.ok) {
        console.warn(`⚠️ ${source.name} returned ${resp.status}, skipping`);
        continue;
      }
      const data = await resp.json();
      const docs = data?.response?.docs || [];
      console.log(`📚 ${docs.length} items from ${source.name}`);
      for (const doc of docs) {
        const slug = doc.identifier.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let licenseOk = true;
        if (doc.licenseurl && !doc.licenseurl.includes('creativecommons') && !doc.licenseurl.includes('publicdomain') && doc.licenseurl !== '') {
          licenseOk = false;
        }
        if (!licenseOk) {
          console.log(`⏭ Skipping ${doc.title}: license ${doc.licenseurl}`);
          continue;
        }
        try {
          console.log(` ingesting "${doc.title}"...`);
          const coverUrl = `https://archive.org/services/img/${doc.identifier}`;
          
          await saveGame({
            title: doc.title,
            slug,
            summary: (doc.description || '').substring(0, 2000) || null,
            releaseDate: doc.year ? new Date(`${doc.year}-01-01`) : null,
            genreNames: 'Horror',
            platformNames: 'Classic',
            coverUrl,
            source: 'archive.org',
            genreIds: [horrorGenreId],
            platformIds: [classicPlatformId],
            developerIds: [unknownDevId],
            purchaseLinks: [{
              storeName: 'Archive.org',
              url: `https://archive.org/details/${doc.identifier}`
            }]
          });

          total++;
        } catch (upsertErr) {
          console.warn(`⚠️ Failed upsert for ${doc.title}:`, upsertErr);
        }
      }
    } catch (e) {
      console.error(`❌ ${source.name} fetch failed:`, e);
    }
  }
  console.log(`✅ Retro ingestion complete. ${total} games processed.`);
}

async function runIngestion() {
  const args = process.argv.slice(2);
  const retroMode = args.includes('--retro');
  if (retroMode) {
    await ingestRetroGames();
    return;
  }
  const twitchId = process.env.TWITCH_CLIENT_ID;
  const twitchSecret = process.env.TWITCH_CLIENT_SECRET;
  const rawgApiKey = process.env.RAWG_API_KEY;

  if (!twitchId || !twitchSecret) {
    console.error("❌ Error: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET missing in .env.");
    process.exit(1);
  }

  if (!rawgApiKey) {
    console.warn("⚠️ Warning: RAWG_API_KEY is missing in your .env file. RAWG metadata enrichment will be unavailable.");
  } else {
    console.log("🔑 RAWG API Key found. RAWG enrichment can be run separately via 'npm run enrich'.");
  }

  console.log("🔑 IGDB API credentials found. Fetching catalog from Twitch Developer servers...");
  try {
    const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`, {
      method: "POST"
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Twitch OAuth failed: ${tokenResponse.statusText}`);
    }

    const { access_token } = await tokenResponse.json() as { access_token: string };
    console.log("✅ Successfully authenticated with Twitch Developer Portal!");

    const reset = args.includes("--reset");
    const sync = args.includes("--sync");
    const isUpcoming = args.includes("--upcoming");
    const forceUpdate = args.includes("--force-update");
    const skipExisting = !sync && !forceUpdate;

    const cursorFile = isUpcoming ? "ingest_upcoming_cursor.json" : "ingest_cursor.json";
    let lastSyncTimestamp: string | null = null;
    let startOffset = 0;

    if (reset) {
      console.log(`🧹 --reset flag passed. Starting ingestion from scratch for cursor '${cursorFile}'.`);
      if (fs.existsSync(cursorFile)) {
        fs.unlinkSync(cursorFile);
      }
    } else if (fs.existsSync(cursorFile)) {
      try {
        const cursorData = JSON.parse(fs.readFileSync(cursorFile, "utf-8"));
        lastSyncTimestamp = cursorData.lastSyncTimestamp || null;
        if (sync) {
          console.log(`🔄 --sync flag passed. Will sync updates since: ${lastSyncTimestamp || "beginning of time"}`);
          startOffset = 0;
        } else {
          startOffset = cursorData.offset || 0;
          console.log(`🔄 Found checkpoint file '${cursorFile}'. Resuming from offset: ${startOffset}...`);
        }
      } catch (e) {
        console.warn(`⚠️ Failed to parse '${cursorFile}'. Starting from offset 0.`);
      }
    }

    let syncTime: number | null = null;
    if (sync) {
      if (lastSyncTimestamp) {
        syncTime = Math.floor(new Date(lastSyncTimestamp).getTime() / 1000);
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        syncTime = Math.floor(thirtyDaysAgo.getTime() / 1000);
        console.log(`⚠️ No previous sync timestamp found. Defaulting to sync updates since 30 days ago (${thirtyDaysAgo.toISOString()}).`);
      }
    }

    let targetLimit = 3000;
    const limitIndex = args.indexOf("--limit");
    if (limitIndex !== -1 && args[limitIndex + 1]) {
      const parsedLimit = parseInt(args[limitIndex + 1], 10);
      if (!isNaN(parsedLimit)) {
        targetLimit = parsedLimit;
        console.log(`🎯 Custom import target set to: ${targetLimit} games.`);
      }
    }

    const BATCH_SIZE = 100;
    const TARGET_TOTAL = targetLimit;
    let offset = startOffset;

    async function processInBatches<T>(
      items: T[],
      batchSize: number,
      fn: (item: T) => Promise<void>
    ) {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(fn));
      }
    }

    const horrorGenreId = await getOrCreateGenre("Horror", "horror");

    console.log("🏷️ Pre-upserting curated Mood Tags...");
    const moodTagMap = new Map<string, string>();
    for (const mood of MOODS) {
      const tagId = await getOrCreateTag(mood.name, mood.slug);
      moodTagMap.set(mood.slug, tagId);
    }

    interface IGDBGame {
      id: number;
      name: string;
      slug: string;
      summary?: string;
      storyline?: string;
      first_release_date?: number;
      total_rating?: number;
      follows?: number;
      cover?: { url: string };
      screenshots?: Array<{ url: string }>;
      videos?: Array<{ video_id: string }>;
      involved_companies?: Array<{
        developer: boolean;
        publisher: boolean;
        company: { name: string; slug: string };
      }>;
      platforms?: Array<{ name: string; slug: string }>;
      genres?: Array<{ id: number; name: string; slug: string }>;
      keywords?: Array<{ id: number; name: string; slug: string }>;
      player_perspectives?: Array<{ id: number; name: string; slug: string }>;
      websites?: Array<{ url: string; category: number }>;
      category?: number;
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    while (offset < TARGET_TOTAL) {
      console.log(`\n=== 📥 Processing Batch: Offset ${offset} (Target Limit: ${BATCH_SIZE}) ===`);

      let whereClause = `themes = (19) & first_release_date != null & cover != null`;
      let sortBy = "total_rating desc";

      if (isUpcoming) {
        whereClause = `themes = (19) & first_release_date > ${currentTimestamp} & cover != null`;
        sortBy = "first_release_date asc";
      }

      if (syncTime) {
        whereClause += ` & updated_at > ${syncTime}`;
      }

      const query = `
        fields name, slug, summary, storyline, first_release_date, total_rating, follows,
          cover.url,
          screenshots.url,
          videos.video_id,
          involved_companies.developer, involved_companies.publisher, involved_companies.company.name, involved_companies.company.slug,
          platforms.name, platforms.slug,
          genres.name, genres.slug,
          keywords.name, keywords.slug,
          player_perspectives.name, player_perspectives.slug,
          websites.url, websites.category, category;
        where ${whereClause};
        sort ${sortBy};
        limit ${BATCH_SIZE};
        offset ${offset};
      `;

      const igdbResponse = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
          "Client-ID": twitchId,
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "text/plain"
        },
        body: query
      });

      if (!igdbResponse.ok) {
        const errorText = await igdbResponse.text();
        console.error(`❌ IGDB API Error Details: ${errorText}`);
        throw new Error(`IGDB request failed for offset ${offset}: ${igdbResponse.statusText}`);
      }

      const games = await igdbResponse.json() as IGDBGame[];
      if (!games || games.length === 0) {
        console.log("🏁 No more games returned from IGDB. Ingestion complete!");
        break;
      }

      console.log(`📚 Fetched ${games.length} horror games from IGDB. Processing...`);

      const uniqueDevelopers = new Map<string, { name: string; slug: string }>();
      const uniquePublishers = new Map<string, { name: string; slug: string }>();
      const uniquePlatforms = new Map<string, { name: string; slug: string }>();
      const uniqueGenres = new Map<string, { name: string; slug: string; id: number }>();

      const seenDevNames = new Set<string>();
      const seenPubNames = new Set<string>();

      for (const g of games) {
        if (g.involved_companies) {
          for (const ic of g.involved_companies) {
            if (!ic.company) continue;
            const compName = ic.company.name;
            const compSlug = ic.company.slug || compName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            if (ic.developer) {
              if (!uniqueDevelopers.has(compSlug) && !seenDevNames.has(compName)) {
                uniqueDevelopers.set(compSlug, { name: compName, slug: compSlug });
                seenDevNames.add(compName);
              }
            }
            if (ic.publisher) {
              if (!uniquePublishers.has(compSlug) && !seenPubNames.has(compName)) {
                uniquePublishers.set(compSlug, { name: compName, slug: compSlug });
                seenPubNames.add(compName);
              }
            }
          }
        }
        if (g.platforms) {
          for (const p of g.platforms) {
            const platSlug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            uniquePlatforms.set(platSlug, { name: p.name, slug: platSlug });
          }
        }
        if (g.genres) {
          for (const gen of g.genres) {
            const genSlug = gen.slug || gen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            uniqueGenres.set(genSlug, { name: gen.name, slug: genSlug, id: gen.id });
          }
        }
      }

      console.log(`Pre-upserting relations: ${uniqueDevelopers.size} developers, ${uniquePublishers.size} publishers, ${uniquePlatforms.size} platforms, ${uniqueGenres.size} genres...`);

      const developerMap = new Map<string, string>();
      const devsArray = Array.from(uniqueDevelopers.values());
      await processInBatches(devsArray, 20, async (dev) => {
        const id = await getOrCreateDeveloper(dev.name, dev.slug);
        developerMap.set(dev.slug, id);
      });

      const publisherMap = new Map<string, string>();
      const pubsArray = Array.from(uniquePublishers.values());
      await processInBatches(pubsArray, 20, async (pub) => {
        const id = await getOrCreatePublisher(pub.name, pub.slug);
        publisherMap.set(pub.slug, id);
      });

      const platformMap = new Map<string, string>();
      const platsArray = Array.from(uniquePlatforms.values());
      await processInBatches(platsArray, 20, async (plat) => {
        const id = await getOrCreatePlatform(plat.name, plat.slug);
        platformMap.set(plat.slug, id);
      });

      const genreMap = new Map<string, string>();
      const genresArray = Array.from(uniqueGenres.values());
      await processInBatches(genresArray, 20, async (gen) => {
        const id = await getOrCreateGenre(gen.name, gen.slug, gen.id);
        genreMap.set(gen.slug, id);
      });

      const seenSlugs = new Set<string>();
      const uniqueGames = games.filter(g => {
        const slug = g.slug || g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (seenSlugs.has(slug)) return false;
        seenSlugs.add(slug);
        return true;
      });

      console.log("🔍 Checking existing games in database to optimize operations...");
      const batchIgdbIds = uniqueGames.map(g => g.id).filter(id => id !== undefined);
      const batchSlugs = uniqueGames.map(g => g.slug || g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));

      // Query database to see what exists
      const existingRows = await turso
        .select({ id: schema.games.id, slug: schema.games.slug, igdbId: schema.games.igdbId })
        .from(schema.games)
        .where(
          or(
            inArray(schema.games.slug, batchSlugs),
            batchIgdbIds.length > 0 ? inArray(schema.games.igdbId, batchIgdbIds) : sql`0`
          )
        );

      const existingSlugs = new Set(existingRows.map(g => g.slug));
      const existingIgdbIds = new Set(existingRows.map(g => g.igdbId).filter((id): id is number => id !== null));

      let gamesToProcess = uniqueGames;
      if (skipExisting) {
        gamesToProcess = uniqueGames.filter(g => {
          const slug = g.slug || g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const exists = existingSlugs.has(slug) || (g.id !== undefined && existingIgdbIds.has(g.id));
          return !exists;
        });
        console.log(`⏩ Skipping ${uniqueGames.length - gamesToProcess.length} already imported games in this batch. Processing ${gamesToProcess.length} new games.`);
      }

      async function processGamesInBatches<T>(
        items: T[],
        batchSize: number,
        fn: (item: T) => Promise<void>
      ) {
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          await Promise.all(batch.map(fn));
          console.log(`Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(items.length / batchSize)}`);
        }
      }

      const processGame = async (g: IGDBGame) => {
        const slug = g.slug || g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        console.log(`Processing: ${g.name}`);
        
        const releaseDate = g.first_release_date ? new Date(g.first_release_date * 1000) : null;
        const rating = g.total_rating || null;
        const popularity = g.follows || null;
        const status = releaseDate && releaseDate > new Date() ? "upcoming" : "released";

        let coverUrl = g.cover?.url || null;
        if (coverUrl && coverUrl.startsWith("//")) {
          coverUrl = `https:${coverUrl}`;
        }
        if (coverUrl) {
          coverUrl = coverUrl.replace("t_thumb", "t_cover_big");
        }

        const screenshots: string[] = [];
        if (g.screenshots) {
          for (const s of g.screenshots) {
            let sUrl = s.url;
            if (sUrl.startsWith("//")) {
              sUrl = `https:${sUrl}`;
            }
            screenshots.push(sUrl.replace("t_thumb", "t_screenshot_huge"));
          }
        }

        let trailerUrl = null;
        if (g.videos && g.videos.length > 0) {
          trailerUrl = `https://www.youtube.com/embed/${g.videos[0].video_id}`;
        }

        const developerIds: string[] = [];
        const publisherIds: string[] = [];
        if (g.involved_companies) {
          for (const ic of g.involved_companies) {
            if (!ic.company) continue;
            const compName = ic.company.name;
            const compSlug = ic.company.slug || compName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            if (ic.developer) {
              const devId = developerMap.get(compSlug);
              if (devId) developerIds.push(devId);
            }
            if (ic.publisher) {
              const pubId = publisherMap.get(compSlug);
              if (pubId) publisherIds.push(pubId);
            }
          }
        }

        const platformIds: string[] = [];
        if (g.platforms) {
          for (const p of g.platforms) {
            const platSlug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const platId = platformMap.get(platSlug);
            if (platId) platformIds.push(platId);
          }
        }

        const gameGenreIds: string[] = [];
        if (g.genres) {
          for (const gen of g.genres) {
            const genSlug = gen.slug || gen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const genreId = genreMap.get(genSlug);
            if (genreId) gameGenreIds.push(genreId);
          }
        }
        if (!gameGenreIds.includes(horrorGenreId)) {
          gameGenreIds.push(horrorGenreId);
        }

        // Apply Mood tagging rules automatically
        const tagIds: string[] = [];
        const matchedMoods = await getMoodTagsForGame({
          title: g.name,
          summary: g.summary || "",
          storyline: g.storyline || "",
          genreNames: g.genres?.map(gen => gen.name) || [],
          keywords: g.keywords?.map(kw => kw.name) || [],
          playerPerspectives: g.player_perspectives?.map(pp => pp.name) || []
        });

        for (const moodSlug of matchedMoods) {
          const tId = moodTagMap.get(moodSlug);
          if (tId) tagIds.push(tId);
        }

        const developerNames = Array.from(new Set(
          g.involved_companies?.filter(ic => ic.developer).map(ic => ic.company.name) || []
        )).join(", ");

        const genreNames = Array.from(new Set([
          "Horror",
          ...(g.genres?.map(gen => gen.name) || [])
        ])).join(", ");

        const platformNames = Array.from(new Set(
          g.platforms?.map(p => p.name) || []
        )).join(", ");

        const purchaseLinks: Array<{ storeName: string; url: string }> = [];
        if (g.websites) {
          for (const web of g.websites) {
            const url = web.url;
            let storeName = "";
            if (web.category === 13) {
              storeName = "Steam";
            } else if (web.category === 14) {
              storeName = "GOG";
            } else if (web.category === 16) {
              storeName = "Epic Games Store";
            } else if (web.category === 17) {
              storeName = "Itch.io";
            } else if (web.category === 10) {
              storeName = "Android Google Play";
            } else if (web.category === 11) {
              storeName = "iOS App Store";
            } else if (web.category === 23) {
              storeName = "PlayStation Store";
            } else if (web.category === 31) {
              storeName = "Nintendo eShop";
            } else if (web.category === 1) {
              storeName = "Official Website";
            }

            if (storeName) {
              purchaseLinks.push({ storeName, url });
            }
          }
        }

        await saveGame({
          igdbId: g.id,
          title: g.name,
          slug,
          summary: g.summary || null,
          storyline: g.storyline || null,
          releaseDate,
          status,
          coverUrl,
          rating,
          popularity,
          developerNames: developerNames || null,
          genreNames: genreNames || null,
          platformNames: platformNames || null,
          trailerUrl,
          screenshots,
          category: g.category !== undefined ? g.category : null,
          developerIds,
          publisherIds,
          genreIds: gameGenreIds,
          platformIds,
          tagIds,
          purchaseLinks
        });
      };

      await processGamesInBatches(gamesToProcess, 20, processGame);

      offset += games.length;
      fs.writeFileSync(cursorFile, JSON.stringify({
        offset,
        lastSyncTimestamp: new Date().toISOString(),
        lastProcessedGameId: games[games.length - 1]?.id || null,
        totalProcessed: offset
      }, null, 2));
      console.log(`✅ Progress saved. New checkpoint offset is ${offset}.`);

      if (games.length < BATCH_SIZE) {
        console.log("🏁 Reached the end of the IGDB catalog.");
        break;
      }
    }

    console.log("✅ Ingestion from IGDB completed successfully!");

  } catch (error) {
    console.error("❌ Error during IGDB ingestion script execution:", error);
    process.exit(1);
  }
}

runIngestion()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
