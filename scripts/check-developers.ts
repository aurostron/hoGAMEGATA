import "./load-env";
import { turso, schema, count, eq, sql } from "./db-helper";

async function main() {
  console.log("🔍 Fetching developer page statistics...");

  const [devCountRes] = await turso.select({ value: count() }).from(schema.developers);
  const totalDevs = devCountRes.value;

  const [linkCountRes] = await turso.select({ value: count() }).from(schema.gamesToDevelopers);
  const totalLinks = linkCountRes.value;

  // Find developers with most games
  const topDevs = await turso
    .select({
      id: schema.developers.id,
      name: schema.developers.name,
      slug: schema.developers.slug,
      gameCount: count(schema.gamesToDevelopers.gameId)
    })
    .from(schema.developers)
    .leftJoin(schema.gamesToDevelopers, eq(schema.developers.id, schema.gamesToDevelopers.developerId))
    .groupBy(schema.developers.id, schema.developers.name, schema.developers.slug)
    .orderBy(sql`count(${schema.gamesToDevelopers.gameId}) desc`)
    .limit(10);

  // Find games with 0 developers
  // We can query games whose ID is not in the _DeveloperToGame table
  const gamesWithoutDevRes = await turso
    .select({ value: count() })
    .from(schema.games)
    .leftJoin(schema.gamesToDevelopers, eq(schema.games.id, schema.gamesToDevelopers.gameId))
    .where(sql`${schema.gamesToDevelopers.developerId} IS NULL`);
  
  const gamesWithoutDev = gamesWithoutDevRes[0]?.value || 0;

  console.log("\n==================================================");
  console.log("👥 DEVELOPER REGISTRY STATISTICS");
  console.log("==================================================");
  console.log(`📈 Total Registered Developers: ${totalDevs.toLocaleString()}`);
  console.log(`🔗 Total Game-to-Developer Links: ${totalLinks.toLocaleString()}`);
  console.log(`⚠️ Games without any linked Developer: ${gamesWithoutDev.toLocaleString()}`);
  console.log("--------------------------------------------------");
  console.log("🏆 TOP 10 DEVELOPERS BY GAME COUNT:");
  topDevs.forEach((dev, idx) => {
    console.log(`${idx + 1}. ${dev.name} (${dev.gameCount} games) - /developer/${dev.slug}`);
  });
  console.log("==================================================\n");
}

main().catch(console.error);
