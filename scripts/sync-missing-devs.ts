import "./load-env";
import { turso, schema, eq, getOrCreateDeveloper } from "./db-helper";

async function main() {
  console.log("🚀 Starting optimized developer relations sync...");

  // 1. Fetch all developers to cache them in-memory
  console.log("💾 Fetching developers cache...");
  const dbDevs = await turso
    .select({ id: schema.developers.id, slug: schema.developers.slug })
    .from(schema.developers);
  const devCache = new Map<string, string>(); // slug -> id
  for (const d of dbDevs) {
    devCache.set(d.slug, d.id);
  }
  console.log(`✅ Cached ${devCache.size} developers.`);

  // 2. Fetch all existing relations to cache them in-memory
  console.log("💾 Fetching existing developer relations...");
  const dbRelations = await turso
    .select({ gameId: schema.gamesToDevelopers.gameId, developerId: schema.gamesToDevelopers.developerId })
    .from(schema.gamesToDevelopers);
  
  // gameId -> Set of developerIds
  const relationCache = new Map<string, Set<string>>();
  for (const r of dbRelations) {
    if (!relationCache.has(r.gameId)) {
      relationCache.set(r.gameId, new Set());
    }
    relationCache.get(r.gameId)!.add(r.developerId);
  }
  console.log(`✅ Cached relations for ${relationCache.size} games.`);

  // 3. Fetch all games with developerNames
  console.log("💾 Fetching games list...");
  const games = await turso
    .select({
      id: schema.games.id,
      title: schema.games.title,
      developerNames: schema.games.developerNames
    })
    .from(schema.games);
  console.log(`✅ Loaded ${games.length} games.`);

  let linksCreated = 0;
  let devsCreated = 0;
  let fixedGamesCount = 0;

  const crypto = await import("crypto");
  function generateId(): string {
    return crypto.randomUUID();
  }

  // To insert links in batches
  const pendingLinks: Array<{ developerId: string; gameId: string }> = [];
  // To insert developers in batches
  const pendingDevs: Array<{ id: string; name: string; slug: string }> = [];

  for (const game of games) {
    if (!game.developerNames || !game.developerNames.trim()) {
      continue;
    }

    const devNames = game.developerNames
      .split(",")
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (devNames.length === 0) continue;

    const gameRelations = relationCache.get(game.id) || new Set<string>();
    let gameFixed = false;

    for (const name of devNames) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) continue;

      let devId = devCache.get(slug);

      if (!devId) {
        // Create new developer
        devId = generateId();
        pendingDevs.push({
          id: devId,
          name,
          slug
        });
        
        devCache.set(slug, devId);
        devsCreated++;
      }

      if (!gameRelations.has(devId)) {
        pendingLinks.push({
          developerId: devId,
          gameId: game.id
        });
        gameRelations.add(devId);
        linksCreated++;
        gameFixed = true;
      }
    }

    if (gameFixed) {
      fixedGamesCount++;
    }
  }

  // Batch insert developers
  if (pendingDevs.length > 0) {
    console.log(`💾 Inserting ${pendingDevs.length} new developers in batches of 100...`);
    const BATCH_SIZE = 100;
    for (let i = 0; i < pendingDevs.length; i += BATCH_SIZE) {
      const batch = pendingDevs.slice(i, i + BATCH_SIZE);
      await turso.insert(schema.developers).values(batch).onConflictDoNothing();
    }
  }

  // Batch insert links
  if (pendingLinks.length > 0) {
    console.log(`💾 Inserting ${pendingLinks.length} new relations in batches of 100...`);
    const BATCH_SIZE = 100;
    for (let i = 0; i < pendingLinks.length; i += BATCH_SIZE) {
      const batch = pendingLinks.slice(i, i + BATCH_SIZE);
      await turso.insert(schema.gamesToDevelopers).values(batch).onConflictDoNothing();
    }
  }

  console.log(`\n==================================================`);
  console.log(`✅ SYNC COMPLETE`);
  console.log(`==================================================`);
  console.log(`Processed: ${games.length} games`);
  console.log(`New developers created: ${devsCreated}`);
  console.log(`Games fixed with missing links: ${fixedGamesCount}`);
  console.log(`Developer relations created: ${linksCreated}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Failed to sync developer relations:", err);
});
