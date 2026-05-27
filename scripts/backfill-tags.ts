import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { HORROR_TAXONOMY, getTaxonomyTagsForGame } from "./mood-rules";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

let prisma: PrismaClient;
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");

// Connect via session port 5432 for faster batch operations if requested
let targetConnectionString = connectionString;
if (connectionString.includes(":6543")) {
  console.log("🔗 Redirecting database queries to direct session port 5432 for faster backfill execution.");
  targetConnectionString = connectionString.replace(":6543", ":5432");
}

const pool = new Pool({ 
  connectionString: targetConnectionString,
  connectionTimeoutMillis: 60000,
  max: 10,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to safely transition a tag slug and name without unique constraint errors
async function transitionTag(oldSlug: string, newSlug: string, newName: string) {
  const oldTag = await prisma.tag.findUnique({ where: { slug: oldSlug } });
  const newTag = await prisma.tag.findUnique({ where: { slug: newSlug } });

  if (oldTag && newTag) {
    console.log(`  Merging duplicate tags: "${oldSlug}" -> "${newSlug}"`);
    // Connect games from oldTag to newTag, then disconnect oldTag
    const gamesWithOldTag = await prisma.game.findMany({
      where: { tags: { some: { id: oldTag.id } } },
      select: { id: true }
    });
    for (const game of gamesWithOldTag) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          tags: {
            connect: { id: newTag.id },
            disconnect: { id: oldTag.id }
          }
        }
      });
    }
    await prisma.tag.delete({ where: { id: oldTag.id } });
  } else if (oldTag) {
    console.log(`  Updating tag in-place: "${oldSlug}" -> "${newSlug}" ("${newName}")`);
    const tagWithName = await prisma.tag.findUnique({ where: { name: newName } });
    if (tagWithName && tagWithName.id !== oldTag.id) {
      console.log(`  Name collision! Merging tag "${oldTag.slug}" into "${tagWithName.slug}"`);
      const gamesWithOldTag = await prisma.game.findMany({
        where: { tags: { some: { id: oldTag.id } } },
        select: { id: true }
      });
      for (const game of gamesWithOldTag) {
        await prisma.game.update({
          where: { id: game.id },
          data: {
            tags: {
              connect: { id: tagWithName.id },
              disconnect: { id: oldTag.id }
            }
          }
        });
      }
      await prisma.tag.delete({ where: { id: oldTag.id } });
    } else {
      await prisma.tag.update({
        where: { id: oldTag.id },
        data: { slug: newSlug, name: newName }
      });
    }
  } else if (newTag) {
    // Ensure name is correct
    await prisma.tag.update({
      where: { id: newTag.id },
      data: { name: newName }
    });
  }
}

async function runBackfill() {
  const twitchId = process.env.TWITCH_CLIENT_ID;
  const twitchSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!twitchId || !twitchSecret) {
    console.error("❌ Error: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET missing in .env.");
    process.exit(1);
  }

  console.log("🔑 Authenticating with Twitch Developer Portal...");
  const tokenResponse = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  
  if (!tokenResponse.ok) {
    throw new Error(`Twitch OAuth failed: ${tokenResponse.statusText}`);
  }

  const { access_token } = await tokenResponse.json() as { access_token: string };
  console.log("✅ Authenticated successfully!");

  // Transition and merge clashing old tag structures to the new taxonomy first
  console.log("🔄 Resolving tag collisions and database constraints...");
  const migrationRules = [
    { oldSlug: "psychological-horror", newSlug: "psychological", newName: "Psychological Horror" },
    { oldSlug: "point---click", newSlug: "point-click", newName: "Point & Click" },
    { oldSlug: "co-op-social", newSlug: "co-op", newName: "Co-op" },
    { oldSlug: "retro-ps1-vibe", newSlug: "retro-ps1", newName: "PS1 / Low Poly" },
    { oldSlug: "slasher-splatter", newSlug: "slasher", newName: "Slasher Horror" },
    { oldSlug: "gothic-supernatural", newSlug: "supernatural", newName: "Supernatural Horror" },
    { oldSlug: "no-combat-stealth", newSlug: "stealth-no-combat", newName: "Stealth & Hide" },
    { oldSlug: "walking-sim-story", newSlug: "walking-sim", newName: "Walking Simulator" },
    { oldSlug: "found-footage-analog", newSlug: "vhs-analog", newName: "VHS / Analog" },
    { oldSlug: "combat-heavy", newSlug: "action-horror", newName: "Action Horror" },
    { oldSlug: "sci-fi-cyber", newSlug: "setting-sci-fi", newName: "Sci-Fi Horror" }
  ];

  for (const rule of migrationRules) {
    await transitionTag(rule.oldSlug, rule.newSlug, rule.newName);
  }
  console.log("✅ Tag transitions and merges completed!");

  // 1. Pre-upsert all Curated Tags
  console.log("🏷️  Pre-upserting all 54 curated taxonomy tags in database...");
  const tagMap = new Map<string, string>();
  for (const tag of HORROR_TAXONOMY) {
    const dbTag = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name },
      create: { name: tag.name, slug: tag.slug }
    });
    tagMap.set(tag.slug, dbTag.id);
  }
  console.log("✅ Curated taxonomy tags populated in Tag table!");

  // 2. Fetch all games from DB
  console.log("🔍 Fetching all games from database to resolve keywords...");
  const games = await prisma.game.findMany({
    select: {
      id: true,
      igdbId: true,
      title: true,
      summary: true,
      storyline: true,
      genres: {
        select: { name: true, slug: true }
      }
    }
  });

  const totalGames = games.length;
  console.log(`📚 Found ${totalGames} games in database. Fetching keywords from IGDB...`);

  // 3. Batch fetch keywords from IGDB
  const keywordMap = new Map<number, Array<{ name: string; slug: string }>>();
  const BATCH_SIZE = 100;

  for (let i = 0; i < totalGames; i += BATCH_SIZE) {
    const chunk = games.slice(i, i + BATCH_SIZE);
    const igdbIds = chunk.map(g => g.igdbId).filter((id): id is number => id !== null);

    if (igdbIds.length === 0) continue;

    console.log(`📥 Fetching keywords for batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(totalGames / BATCH_SIZE)} (IDs: ${igdbIds.length})...`);

    const query = `
      fields id, keywords.name, keywords.slug;
      where id = (${igdbIds.join(",")});
      limit 100;
    `;

    try {
      const response = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
          "Client-ID": twitchId,
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "text/plain"
        },
        body: query
      });

      if (!response.ok) {
        console.error(`⚠️ Failed to fetch keywords for batch: ${response.statusText}`);
      } else {
        const data = await response.json() as Array<{ id: number; keywords?: Array<{ name: string; slug: string }> }>;
        for (const item of data) {
          if (item.keywords) {
            keywordMap.set(item.id, item.keywords);
          }
        }
      }
    } catch (err) {
      console.error(`⚠️ Network error on batch fetch:`, err);
    }

    // Throttle queries to avoid IGDB rate limits (4 req/sec limit)
    await sleep(300);
  }

  console.log(`\n🏷️  Applying taxonomy rules and writing tags/scores to ${totalGames} games...`);

  // Helper batch writer with concurrency limit
  let processed = 0;
  const CONCURRENCY = 20;

  for (let i = 0; i < totalGames; i += CONCURRENCY) {
    const chunk = games.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async (game) => {
      const igdbKeywords = game.igdbId ? keywordMap.get(game.igdbId) || [] : [];
      const { tags: matchedTags, scores } = getTaxonomyTagsForGame({
        title: game.title,
        summary: game.summary,
        storyline: game.storyline,
        genres: game.genres,
        keywords: igdbKeywords
      });

      const tagConnects = matchedTags
        .map(tag => {
          const tid = tagMap.get(tag.slug);
          return tid ? { id: tid } : null;
        })
        .filter((t): t is { id: string } => t !== null);

      await prisma.game.update({
        where: { id: game.id },
        data: {
          tags: {
            set: tagConnects
          },
          taxonomyScores: scores
        }
      });
    }));

    processed += chunk.length;
    if (processed % 200 === 0 || processed === totalGames) {
      console.log(`  ⚡ Processed and tagged: ${processed} / ${totalGames} games.`);
    }
  }

  console.log("\n🎉 Backfill tagging completed successfully!");
}

runBackfill()
  .then(() => {
    prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Backfill Error:", err);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
