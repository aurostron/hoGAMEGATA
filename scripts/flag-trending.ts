import "./load-env";
import {
  turso,
  schema,
  inArray,
  desc
} from "./db-helper";

async function runFlagging() {
  console.log("🚀 Starting Cloudinary Trending Flag Script...");

  // 1. Reset all games to isTrending = false
  console.log("🧹 Resetting existing trending flags...");
  await turso.update(schema.games).set({ isTrending: false });

  // 2. Get Top 100 Games by popularity
  const topGames = await turso
    .select({ id: schema.games.id })
    .from(schema.games)
    .orderBy(desc(schema.games.popularity))
    .limit(100);

  const topGameIds = topGames.map(g => g.id);
  console.log(`✅ Found ${topGames.length} top games to flag.`);

  // 3. Set isTrending = true for the top 100
  if (topGameIds.length > 0) {
    const result = await turso
      .update(schema.games)
      .set({ isTrending: true })
      .where(inArray(schema.games.id, topGameIds));
  }

  console.log(`🎉 Successfully flagged ${topGameIds.length} games as trending!`);
  console.log("These games will now automatically use Cloudinary caching on the frontend.");
}

runFlagging().catch((err) => {
  console.error(err);
  process.exit(1);
});
