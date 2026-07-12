import "./load-env";
import {
  turso,
  schema,
  eq,
  generateId
} from "./db-helper";

async function generateRecommendations() {
  const startTime = Date.now();
  console.log("⚡ Starting precomputed recommendation generation based on shared genres, tags, and developers...");

  try {
    console.log("🧹 Clearing old recommendations...");
    await turso.delete(schema.gameRecommendations);

    console.log("📥 Loading all games and relations into memory...");
    const allGames = await turso
      .select({
        id: schema.games.id,
        title: schema.games.title
      })
      .from(schema.games);

    const allGenres = await turso.select().from(schema.gamesToGenres);
    const allTags = await turso.select().from(schema.gamesToTags);
    const allDevs = await turso.select().from(schema.gamesToDevelopers);

    const gameGenresMap = new Map<string, Set<string>>();
    const gameTagsMap = new Map<string, Set<string>>();
    const gameDevsMap = new Map<string, Set<string>>();

    for (const g of allGenres) {
      if (!gameGenresMap.has(g.gameId)) gameGenresMap.set(g.gameId, new Set());
      gameGenresMap.get(g.gameId)!.add(g.genreId);
    }
    for (const t of allTags) {
      if (!gameTagsMap.has(t.gameId)) gameTagsMap.set(t.gameId, new Set());
      gameTagsMap.get(t.gameId)!.add(t.tagId);
    }
    for (const d of allDevs) {
      if (!gameDevsMap.has(d.gameId)) gameDevsMap.set(d.gameId, new Set());
      gameDevsMap.get(d.gameId)!.add(d.developerId);
    }

    console.log(`🧠 Calculating recommendations for ${allGames.length} games...`);

    const recommendationRows: Array<{ gameId: string, recommendedGameId: string, distance: number }> = [];

    for (const gameA of allGames) {
      const genresA = gameGenresMap.get(gameA.id) || new Set();
      const tagsA = gameTagsMap.get(gameA.id) || new Set();
      const devsA = gameDevsMap.get(gameA.id) || new Set();

      const matches: Array<{ gameId: string, score: number }> = [];

      for (const gameB of allGames) {
        if (gameA.id === gameB.id) continue;

        const genresB = gameGenresMap.get(gameB.id) || new Set();
        const tagsB = gameTagsMap.get(gameB.id) || new Set();
        const devsB = gameDevsMap.get(gameB.id) || new Set();

        let sharedGenres = 0;
        for (const g of genresA) {
          if (genresB.has(g)) sharedGenres++;
        }

        let sharedTags = 0;
        for (const t of tagsA) {
          if (tagsB.has(t)) sharedTags++;
        }

        let sharedDevs = 0;
        for (const d of devsA) {
          if (devsB.has(d)) sharedDevs++;
        }

        // Calculate similarity score
        // Genre match weight: 10, Tag match weight: 3, Developer match weight: 5
        const score = (sharedGenres * 10) + (sharedTags * 3) + (sharedDevs * 5);

        if (score > 0) {
          matches.push({ gameId: gameB.id, score });
        }
      }

      // Sort descending by score
      matches.sort((a, b) => b.score - a.score);

      // Take top 10 matches
      const topMatches = matches.slice(0, 10);
      for (const m of topMatches) {
        // Distance is inverse of similarity: higher similarity -> lower distance
        const distance = parseFloat((1 / (1 + m.score)).toFixed(4));
        recommendationRows.push({
          gameId: gameA.id,
          recommendedGameId: m.gameId,
          distance
        });
      }
    }

    console.log(`💾 Writing ${recommendationRows.length} recommendations to Turso in chunks of 500...`);
    
    const CHUNK_SIZE = 500;
    for (let i = 0; i < recommendationRows.length; i += CHUNK_SIZE) {
      const chunk = recommendationRows.slice(i, i + CHUNK_SIZE);
      await turso.insert(schema.gameRecommendations).values(chunk);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Success! Generated and saved ${recommendationRows.length} recommendation pairs in ${elapsed}s.`);
  } catch (err) {
    console.error("❌ Recommendation generation failed:", err);
  }
}

generateRecommendations().catch(console.error);
