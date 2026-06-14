import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { pipeline } from "@xenova/transformers";
import { getTaxonomyTagsForGame } from "./mood-rules";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

let prisma: PrismaClient;
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 60000,
  max: 10,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
prisma = new PrismaClient({ adapter });

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

  // Find games that have a summary/storyline and haven't been tagged by the AI classifier yet.
  // We can track this using `taxonomyScores` JSON column (if null or empty) to identify unclassified games.
  console.log(`🔍 Querying up to ${limit} games needing AI mood classification...`);
  const games = await prisma.game.findMany({
    where: {
      OR: [
        { taxonomyScores: null },
        { taxonomyScores: { equals: {} } }
      ],
      OR: [
        { NOT: { summary: null } },
        { NOT: { storyline: null } }
      ]
    },
    include: {
      tags: true,
      genres: true
    },
    take: limit
  });

  if (games.length === 0) {
    console.log("🎉 All games have already been processed with AI mood classification!");
    return;
  }

  console.log(`🤖 Starting AI classification for ${games.length} games...`);

  // We process these one-by-one or in very small sequential steps since NLP classifier is CPU bound
  let processed = 0;
  for (const game of games) {
    processed++;
    console.log(`[${processed}/${games.length}] Classifying: "${game.title}"...`);

    // Prepare inputs formatted for mood classification
    const gameInput = {
      title: game.title,
      summary: game.summary,
      storyline: game.storyline,
      genres: game.genres.map(g => ({ name: g.name, slug: g.slug })),
      keywords: [] // Keywords are not locally saved in schema, but title/summary/storyline/genres are sufficient
    };

    try {
      const { tags, scores } = await getTaxonomyTagsForGame(gameInput, classifier);

      // Upsert tags and link to the game
      const tagConnectIds: string[] = [];
      for (const t of tags) {
        const dbTag = await prisma.tag.upsert({
          where: { slug: t.slug },
          update: {},
          create: { name: t.name, slug: t.slug }
        });
        tagConnectIds.push(dbTag.id);
      }

      await prisma.game.update({
        where: { id: game.id },
        data: {
          taxonomyScores: scores,
          tags: {
            connect: tagConnectIds.map(id => ({ id }))
          }
        }
      });
      console.log(`  ✅ Tagged with: ${tags.map(t => t.name).join(", ")}`);
    } catch (err) {
      console.error(`  ❌ Failed to classify "${game.title}":`, err);
    }
  }

  console.log(`\n🎉 AI Mood tagging complete! Processed ${processed} games.`);
}

runMoodTagging()
  .then(() => {
    prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Mood Tagging Error:", err);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
