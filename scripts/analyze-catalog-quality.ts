import "./load-env";
import { rawDb } from "./dedup-pass2/client";

async function main() {
  console.log("=== CATALOG QUALITY & HORROR INTEGRITY AUDIT ===");

  // 1. Missing or ultra-short summaries (< 20 chars)
  const shortSummaryRes = await rawDb.execute(`
    SELECT count(*) as count 
    FROM "Game" 
    WHERE (status IS NULL OR status != 'hidden')
      AND (summary IS NULL OR length(summary) < 20)
  `);
  console.log(`Games with missing or ultra-short (<20 chars) summary: ${shortSummaryRes.rows[0].count}`);

  // 2. Sample 10 ultra-short summary games
  const shortSamples = await rawDb.execute(`
    SELECT id, title, slug, summary, source, "coverUrl"
    FROM "Game"
    WHERE (status IS NULL OR status != 'hidden')
      AND (summary IS NULL OR length(summary) < 20)
    LIMIT 10
  `);
  console.log("\nSample 10 games with ultra-short summary:");
  shortSamples.rows.forEach(r => console.log(` - "${r.title}" (${r.slug}) [${r.source || 'igdb'}] -> "${r.summary || 'NULL'}"`));

  // 3. Check for obvious non-game / utility words in title
  const utilityTerms = ['calculator', 'soundtrack', 'ost', 'artbook', 'wallpaper', 'trailer', 'manual', 'benchmark', 'server', 'tool'];
  console.log("\nChecking for utility/non-game keywords:");
  for (const t of utilityTerms) {
    const res = await rawDb.execute({
      sql: `SELECT count(*) as count FROM "Game" WHERE (status IS NULL OR status != 'hidden') AND lower(title) LIKE ?`,
      args: [`%${t}%`]
    });
    console.log(` - Title contains "${t}": ${res.rows[0].count} games`);
  }
}

main().catch(console.error);
