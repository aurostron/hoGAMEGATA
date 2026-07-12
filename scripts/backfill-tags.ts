import "./load-env";
import { HORROR_TAXONOMY, getTaxonomyTagsForGame } from "./mood-rules";
import {
  turso,
  schema,
  eq,
  and,
  or,
  inArray,
  getOrCreateTag,
  generateId
} from "./db-helper";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function transitionTag(oldSlug: string, newSlug: string, newName: string) {
  const [oldTag] = await turso.select().from(schema.tags).where(eq(schema.tags.slug, oldSlug)).limit(1);
  const [newTag] = await turso.select().from(schema.tags).where(eq(schema.tags.slug, newSlug)).limit(1);

  if (oldTag && newTag) {
    console.log(`  Merging duplicate tags: "${oldSlug}" -> "${newSlug}"`);
    const gamesWithOldTag = await turso
      .select({ gameId: schema.gamesToTags.gameId })
      .from(schema.gamesToTags)
      .where(eq(schema.gamesToTags.tagId, oldTag.id));
      
    for (const g of gamesWithOldTag) {
      await turso.insert(schema.gamesToTags).values({ gameId: g.gameId, tagId: newTag.id }).onConflictDoNothing();
      await turso.delete(schema.gamesToTags).where(and(eq(schema.gamesToTags.gameId, g.gameId), eq(schema.gamesToTags.tagId, oldTag.id)));
    }
    await turso.delete(schema.tags).where(eq(schema.tags.id, oldTag.id));
  } else if (oldTag) {
    console.log(`  Updating tag in-place: "${oldSlug}" -> "${newSlug}" ("${newName}")`);
    const [tagWithName] = await turso.select().from(schema.tags).where(eq(schema.tags.name, newName)).limit(1);
    if (tagWithName && tagWithName.id !== oldTag.id) {
      console.log(`  Name collision! Merging tag "${oldTag.slug}" into "${tagWithName.slug}"`);
      const gamesWithOldTag = await turso
        .select({ gameId: schema.gamesToTags.gameId })
        .from(schema.gamesToTags)
        .where(eq(schema.gamesToTags.tagId, oldTag.id));
        
      for (const g of gamesWithOldTag) {
        await turso.insert(schema.gamesToTags).values({ gameId: g.gameId, tagId: tagWithName.id }).onConflictDoNothing();
        await turso.delete(schema.gamesToTags).where(and(eq(schema.gamesToTags.gameId, g.gameId), eq(schema.gamesToTags.tagId, oldTag.id)));
      }
      await turso.delete(schema.tags).where(eq(schema.tags.id, oldTag.id));
    } else {
      await turso.update(schema.tags).set({ slug: newSlug, name: newName }).where(eq(schema.tags.id, oldTag.id));
    }
  } else if (newTag) {
    await turso.update(schema.tags).set({ name: newName }).where(eq(schema.tags.id, newTag.id));
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

  console.log("🏷️  Pre-upserting all 54 curated taxonomy tags in database...");
  const tagMap = new Map<string, string>();
  for (const tag of HORROR_TAXONOMY) {
    const dbTagId = await getOrCreateTag(tag.name, tag.slug);
    tagMap.set(tag.slug, dbTagId);
  }
  console.log("✅ Curated taxonomy tags populated in Tag table!");

  console.log("🔍 Fetching all games from database to resolve keywords...");
  const games = await turso
    .select({
      id: schema.games.id,
      igdbId: schema.games.igdbId,
      title: schema.games.title,
      summary: schema.games.summary,
      storyline: schema.games.storyline
    })
    .from(schema.games);

  const totalGames = games.length;
  console.log(`📚 Found ${totalGames} games in database. Fetching keywords from IGDB...`);

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

    await sleep(300);
  }

  console.log(`\n🏷️  Applying taxonomy rules and writing tags/scores to ${totalGames} games...`);

  let processed = 0;
  const CONCURRENCY = 20;

  for (let i = 0; i < totalGames; i += CONCURRENCY) {
    const chunk = games.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async (game) => {
      const genres = await turso
        .select({ name: schema.genres.name, slug: schema.genres.slug })
        .from(schema.gamesToGenres)
        .innerJoin(schema.genres, eq(schema.gamesToGenres.genreId, schema.genres.id))
        .where(eq(schema.gamesToGenres.gameId, game.id));

      const igdbKeywords = game.igdbId ? keywordMap.get(game.igdbId) || [] : [];
      const { tags: matchedTags, scores } = await getTaxonomyTagsForGame({
        title: game.title,
        summary: game.summary,
        storyline: game.storyline,
        genres: genres,
        keywords: igdbKeywords
      });

      const tagConnects = matchedTags
        .map(tag => tagMap.get(tag.slug))
        .filter((tid): tid is string => tid !== undefined);

      await turso.delete(schema.gamesToTags).where(eq(schema.gamesToTags.gameId, game.id));
      
      if (tagConnects.length > 0) {
        await turso.insert(schema.gamesToTags).values(
          tagConnects.map(tid => ({ gameId: game.id, tagId: tid }))
        );
      }

      await turso
        .update(schema.games)
        .set({ taxonomyScores: JSON.stringify(scores) })
        .where(eq(schema.games.id, game.id));
    }));

    processed += chunk.length;
    if (processed % 200 === 0 || processed === totalGames) {
      console.log(`  ⚡ Processed and tagged: ${processed} / ${totalGames} games.`);
    }
  }

  console.log("\n🎉 Backfill tagging completed successfully!");
}

runBackfill().catch((err) => {
  console.error("❌ Backfill Error:", err);
  process.exit(1);
});
