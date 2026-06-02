import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

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

async function runIngestion() {
  const twitchId = process.env.TWITCH_CLIENT_ID;
  const twitchSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!twitchId || !twitchSecret) {
    console.error("❌ Error: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET missing in .env.");
    process.exit(1);
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

    // 2. Fetch Horror Games
    // Theme ID for Horror is 19
    const query = `
      fields name, slug, summary, storyline, first_release_date, total_rating,
        cover.url,
        screenshots.url,
        videos.video_id,
        involved_companies.developer, involved_companies.publisher, involved_companies.company.name, involved_companies.company.slug,
        platforms.name, platforms.slug,
        websites.url, websites.category;
      where themes = (19) & first_release_date != null & cover != null & (total_rating != null | slug = "silent-hill-f");
      sort total_rating desc;
      limit 200;
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
      throw new Error(`IGDB request failed: ${igdbResponse.statusText}`);
    }

    interface IGDBGame {
      id: number;
      name: string;
      slug: string;
      summary?: string;
      storyline?: string;
      first_release_date?: number;
      total_rating?: number;
      cover?: { url: string };
      screenshots?: Array<{ url: string }>;
      videos?: Array<{ video_id: string }>;
      involved_companies?: Array<{
        developer: boolean;
        publisher: boolean;
        company: { name: string; slug: string };
      }>;
      platforms?: Array<{ name: string; slug: string }>;
      websites?: Array<{ url: string; category: number }>;
    }

    const games = await igdbResponse.json() as IGDBGame[];
    console.log(`📚 Fetched ${games.length} horror games from IGDB. Processing & saving...`);

    // 3. Pre-process and pre-upsert all unique developers, publishers, platforms
    const uniqueDevelopers = new Map<string, { name: string; slug: string }>();
    const uniquePublishers = new Map<string, { name: string; slug: string }>();
    const uniquePlatforms = new Map<string, { name: string; slug: string }>();

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
    }

    // Concurrency batch runner
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

    console.log(`Pre-upserting relations: ${uniqueDevelopers.size} developers, ${uniquePublishers.size} publishers, ${uniquePlatforms.size} platforms...`);

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
    console.log("✅ Pre-upserted unique developers.");

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
    console.log("✅ Pre-upserted unique publishers.");

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
    console.log("✅ Pre-upserted unique platforms.");

    // Pre-upsert Horror genre
    const horrorGenre = await prisma.genre.upsert({
      where: { slug: "horror" },
      update: {},
      create: { name: "Horror", slug: "horror" }
    });
    const horrorGenreId = horrorGenre.id;

    console.log("✅ Finished pre-upserting relations. Upserting games in parallel batches...");

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
      
      const releaseDate = g.first_release_date ? new Date(g.first_release_date * 1000) : null;
      const rating = g.total_rating || null;
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
            trailerUrl,
            screenshots,
            developers: {
              set: developerIds.map(id => ({ id }))
            },
            publishers: {
              set: publisherIds.map(id => ({ id }))
            },
            genres: {
              set: [{ id: horrorGenreId }]
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
            trailerUrl,
            screenshots,
            developers: {
              connect: developerIds.map(id => ({ id }))
            },
            publishers: {
              connect: publisherIds.map(id => ({ id }))
            },
            genres: {
              connect: [{ id: horrorGenreId }]
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
