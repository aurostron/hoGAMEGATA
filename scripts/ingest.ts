import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { MOODS, getMoodTagsForGame } from "./mood-rules";


dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

let prisma: PrismaClient;
if (connectionString.startsWith("prisma+postgres://")) {
  prisma = new PrismaClient({ accelerateUrl: connectionString });
} else {
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
  const pool = new Pool({ 
    connectionString,
    connectionTimeoutMillis: 60000,
    max: 10,
    ssl: isLocal ? undefined : { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

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
    // 1. Try to fetch directly by slug
    const directUrl = `https://api.rawg.io/api/games/${slug}?key=${apiKey}`;
    const directResponse = await fetch(directUrl);
    
    if (directResponse.ok) {
      const data = await directResponse.json();
      return parseRawgData(data);
    }

    // 2. If 404, fallback to search by title
    console.log(`🔍 RAWG direct slug match failed for '${slug}'. Searching by title '${title}'...`);
    const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
    const searchResponse = await fetch(searchUrl);
    
    if (searchResponse.ok) {
      const searchData = (await searchResponse.json()) as { results?: any[] };
      const bestMatch = searchData.results?.[0];
      
      if (bestMatch) {
        // Fetch detailed data for this game ID
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

async function runIngestion() {
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
    // 1. Authorize with Twitch
    const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`, {
      method: "POST"
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Twitch OAuth failed: ${tokenResponse.statusText}`);
    }

    const { access_token } = await tokenResponse.json() as { access_token: string };
    console.log("✅ Successfully authenticated with Twitch Developer Portal!");

    // Check if we should reset or if there is a cursor
    const cursorFile = "ingest_cursor.json";
    let lastSyncTimestamp: string | null = null;

    const args = process.argv.slice(2);
    const reset = args.includes("--reset");
    const sync = args.includes("--sync");

    if (reset) {
      console.log("🧹 --reset flag passed. Starting ingestion from scratch.");
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


    // Support custom target limit via --limit <number> (default to 3000)
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

    // Helper: Concurrency batch runner
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

    // Pre-upsert Horror genre once (outside loop is perfect)
    const horrorGenre = await prisma.genre.upsert({
      where: { slug: "horror" },
      update: {},
      create: { name: "Horror", slug: "horror" }
    });
    const horrorGenreId = horrorGenre.id;

    // Pre-upsert all curated Mood Tags
    console.log("🏷️ Pre-upserting curated Mood Tags...");
    const moodTagMap = new Map<string, string>(); // slug -> database id
    for (const mood of MOODS) {
      const dbTag = await prisma.tag.upsert({
        where: { slug: mood.slug },
        update: { name: mood.name },
        create: { name: mood.name, slug: mood.slug }
      });
      moodTagMap.set(mood.slug, dbTag.id);
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
      websites?: Array<{ url: string; category: number }>;
      category?: number;
    }


    while (offset < TARGET_TOTAL) {
      console.log(`\n=== 📥 Processing Batch: Offset ${offset} (Target Limit: ${BATCH_SIZE}) ===`);

      // 2. Fetch Horror Games
      // Theme ID for Horror is 19
      let whereClause = `themes = (19) & first_release_date != null & cover != null & (total_rating != null | slug = "silent-hill-f")`;
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
          websites.url, websites.category, category;
        where ${whereClause};
        sort total_rating desc;
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

      // 3. Pre-process and pre-upsert all unique developers, publishers, platforms, genres for this batch
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

      // Upsert all unique developers in parallel batches by slug
      const developerMap = new Map<string, string>();
      const devsArray = Array.from(uniqueDevelopers.values());
      await processInBatches(devsArray, 20, async (dev) => {
        const dbDev = await prisma.developer.upsert({
          where: { slug: dev.slug },
          update: { name: dev.name },
          create: { name: dev.name, slug: dev.slug }
        });
        developerMap.set(dev.slug, dbDev.id);
      });

      // Upsert all unique publishers in parallel batches by slug
      const publisherMap = new Map<string, string>();
      const pubsArray = Array.from(uniquePublishers.values());
      await processInBatches(pubsArray, 20, async (pub) => {
        const dbPub = await prisma.publisher.upsert({
          where: { slug: pub.slug },
          update: { name: pub.name },
          create: { name: pub.name, slug: pub.slug }
        });
        publisherMap.set(pub.slug, dbPub.id);
      });

      // Upsert all unique platforms in parallel batches by slug
      const platformMap = new Map<string, string>();
      const platsArray = Array.from(uniquePlatforms.values());
      await processInBatches(platsArray, 20, async (plat) => {
        const dbPlat = await prisma.platform.upsert({
          where: { slug: plat.slug },
          update: { name: plat.name },
          create: { name: plat.name, slug: plat.slug }
        });
        platformMap.set(plat.slug, dbPlat.id);
      });

      // Upsert all unique genres in parallel batches by slug
      const genreMap = new Map<string, string>();
      const genresArray = Array.from(uniqueGenres.values());
      await processInBatches(genresArray, 20, async (gen) => {
        const dbGen = await prisma.genre.upsert({
          where: { slug: gen.slug },
          update: { name: gen.name, igdbId: gen.id },
          create: { name: gen.name, slug: gen.slug, igdbId: gen.id }
        });
        genreMap.set(gen.slug, dbGen.id);
      });

      // Remove any games with duplicate slugs to avoid database collisions during concurrent runs
      const seenSlugs = new Set<string>();
      const uniqueGames = games.filter(g => {
        const slug = g.slug || g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (seenSlugs.has(slug)) return false;
        seenSlugs.add(slug);
        return true;
      });

      // 4. Fetch existing games and delete their purchase links in bulk before loop
      console.log("🔍 Checking existing games in database to optimize operations...");
      const existingGames = await prisma.game.findMany({
        where: { slug: { in: uniqueGames.map(g => g.slug || g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) } },
        select: { id: true, slug: true }
      });

      const existingSlugs = new Set(existingGames.map(g => g.slug));
      const existingIds = existingGames.map(g => g.id);

      if (existingIds.length > 0) {
        console.log(`🧹 Cleaning old purchase links in bulk for ${existingIds.length} existing games...`);
        await prisma.purchaseLink.deleteMany({
          where: { gameId: { in: existingIds } }
        });
      }

      // Modified batch logger function for game processing
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
        
        // RAWG fetching is decoupled. Enriched in background.
        
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
        if (g.genres && g.genres.length > 0) {
          for (const gen of g.genres) {
            const genSlug = gen.slug || gen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const genId = genreMap.get(genSlug);
            if (genId) gameGenreIds.push(genId);
          }
        }
        if (gameGenreIds.length === 0) {
          gameGenreIds.push(horrorGenreId);
        }

        // Map mood tags for game
        const moodTags = getMoodTagsForGame(g);
        const tagIds: string[] = [];
        for (const t of moodTags) {
          const tid = moodTagMap.get(t.slug);
          if (tid) tagIds.push(tid);
        }

        // Calculate denormalized relation name strings
        const developerNamesList: string[] = [];
        if (g.involved_companies) {
          for (const ic of g.involved_companies) {
            if (ic.company && ic.developer) {
              developerNamesList.push(ic.company.name);
            }
          }
        }
        const developerNames = developerNamesList.join(", ");

        const genreNamesList: string[] = [];
        if (g.genres && g.genres.length > 0) {
          for (const gen of g.genres) {
            genreNamesList.push(gen.name);
          }
        } else {
          genreNamesList.push("Horror");
        }
        const genreNames = genreNamesList.join(", ");

        const platformNamesList: string[] = [];
        if (g.platforms) {
          for (const p of g.platforms) {
            platformNamesList.push(p.name);
          }
        }
        const platformNames = platformNamesList.join(", ");


        const purchaseLinks: Array<{ storeName: string; url: string }> = [];
        if (g.websites) {
          for (const web of g.websites) {
            let storeName = "";
            const url = web.url;
            if (url.includes("store.steampowered.com")) {
              storeName = "Steam";
            } else if (url.includes("gog.com")) {
              storeName = "GOG";
            } else if (url.includes("epicgames.com")) {
              storeName = "Epic Games Store";
            } else if (url.includes("playstation.com")) {
              storeName = "PlayStation Store";
            } else if (url.includes("xbox.com")) {
              storeName = "Xbox Store";
            } else if (url.includes("nintendo.com")) {
              storeName = "Nintendo eShop";
            } else if (web.category === 1) {
              storeName = "Official Website";
            }

            if (storeName) {
              purchaseLinks.push({ storeName, url });
            }
          }
        }

        const isExisting = existingSlugs.has(slug);

        if (isExisting) {
          // Direct update for existing games (much faster than upsert)
          await prisma.game.update({
            where: { slug },
            data: {
              title: g.name,
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
              developers: {
                set: developerIds.map(id => ({ id }))
              },
              publishers: {
                set: publisherIds.map(id => ({ id }))
              },
              genres: {
                set: gameGenreIds.map(id => ({ id }))
              },
              tags: {
                set: tagIds.map(id => ({ id }))
              },
              platforms: {
                set: platformIds.map(id => ({ id }))
              },

              purchaseLinks: {
                create: purchaseLinks
              }
            }
          });
        } else {
          // Direct create for new games (much faster than upsert)
          await prisma.game.create({
            data: {
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
              rawgEnriched: false,
              developers: {
                connect: developerIds.map(id => ({ id }))
              },
              publishers: {
                connect: publisherIds.map(id => ({ id }))
              },
              genres: {
                connect: gameGenreIds.map(id => ({ id }))
              },
              tags: {
                connect: tagIds.map(id => ({ id }))
              },
              platforms: {
                connect: platformIds.map(id => ({ id }))
              },

              purchaseLinks: {
                create: purchaseLinks
              }
            }
          });
        }
      };

      // Run parallel batches with a higher concurrency of 20
      await processGamesInBatches(uniqueGames, 20, processGame);

      // Successfully processed this batch. Increment offset and save to checkpoint.
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
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
