import "./load-env";
import { pipeline } from "@xenova/transformers";
import { getTaxonomyTagsForGame } from "./mood-rules";
import {
  turso,
  schema,
  eq,
  and,
  or,
  isNull,
  isNotNull,
  getOrCreateTag,
  generateId
} from "./db-helper";

async function runMoodTagging() {
  const args = process.argv.slice(2);
  let limit = 100;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      limit = parsedLimit;
    }
  }

  console.log("Loading Zero-Shot NLP Classifier...");
  const classifier = await pipeline("zero-shot-classification", "Xenova/mobilebert-uncased-mnli");
  console.log("Model loaded successfully.");

  console.log(`🔍 Querying up to ${limit} games needing AI mood classification...`);
  const games = await turso
    .select({
      id: schema.games.id,
      title: schema.games.title,
      summary: schema.games.summary,
      storyline: schema.games.storyline
    })
    .from(schema.games)
    .where(
      and(
        or(
          isNull(schema.games.taxonomyScores),
          eq(schema.games.taxonomyScores, "{}"),
          eq(schema.games.taxonomyScores, "")
        ),
        or(
          isNotNull(schema.games.summary),
          isNotNull(schema.games.storyline)
        )
      )
    )
    .limit(limit);

  if (games.length === 0) {
    console.log("🎉 All games have already been processed with AI mood classification!");
    return;
  }

  console.log(`🤖 Starting AI classification for ${games.length} games...`);

  let processed = 0;
  for (const game of games) {
    processed++;
    console.log(`[${processed}/${games.length}] Classifying: "${game.title}"...`);

    const genres = await turso
      .select({ name: schema.genres.name, slug: schema.genres.slug })
      .from(schema.gamesToGenres)
      .innerJoin(schema.genres, eq(schema.gamesToGenres.genreId, schema.genres.id))
      .where(eq(schema.gamesToGenres.gameId, game.id));

    const gameInput = {
      title: game.title,
      summary: game.summary,
      storyline: game.storyline,
      genres: genres.map(g => ({ name: g.name, slug: g.slug })),
      keywords: []
    };

    try {
      const { tags, scores } = await getTaxonomyTagsForGame(gameInput, classifier);

      const tagConnectIds: string[] = [];
      for (const t of tags) {
        const tId = await getOrCreateTag(t.name, t.slug);
        tagConnectIds.push(tId);
      }

      await turso
        .update(schema.games)
        .set({
          taxonomyScores: JSON.stringify(scores)
        })
        .where(eq(schema.games.id, game.id));

      if (tagConnectIds.length > 0) {
        for (const tId of tagConnectIds) {
          await turso
            .insert(schema.gamesToTags)
            .values({ gameId: game.id, tagId: tId })
            .onConflictDoNothing();
        }
      }
      console.log(`  ✅ Tagged with: ${tags.map(t => t.name).join(", ")}`);
    } catch (err) {
      console.error(`  ❌ Failed to classify "${game.title}":`, err);
    }
  }

  console.log(`\n🎉 AI Mood tagging complete! Processed ${processed} games.`);
}

runMoodTagging().catch((err) => {
  console.error("❌ Mood Tagging Error:", err);
  process.exit(1);
});
