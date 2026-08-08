import "./load-env";
import { turso, schema, asc, or, isNull, ne } from "./db-helper";
import { generateVitepressPages } from "./generate-from-sql-dump";

async function main() {
  console.log("🔍 Fetching games from database (minimal query)...");
  
  const allGames = await turso
    .select({
      title: schema.games.title,
      slug: schema.games.slug,
      developerNames: schema.games.developerNames,
      status: schema.games.status,
    })
    .from(schema.games)
    .where(or(isNull(schema.games.status), ne(schema.games.status, "hidden")))
    .orderBy(asc(schema.games.title));

  console.log(`✅ Loaded ${allGames.length} minimal game entries.`);
  generateVitepressPages(allGames);
}

main().catch(err => {
  console.error("❌ Export error:", err);
  process.exit(1);
});
