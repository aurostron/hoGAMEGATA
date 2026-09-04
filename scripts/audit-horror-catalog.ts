import "./load-env";
import { rawDb } from "./dedup-pass2/client";

async function main() {
  console.log("==================================================");
  console.log("🔍 COMPREHENSIVE HORROR CATALOG COMPOSITION AUDIT");
  console.log("==================================================");

  // 1. Sources breakdown
  const sourcesRes = await rawDb.execute(`
    SELECT COALESCE(source, 'igdb/legacy') as src, count(*) as count 
    FROM "Game" 
    WHERE status IS NULL OR status != 'hidden'
    GROUP BY COALESCE(source, 'igdb/legacy')
    ORDER BY count DESC
  `);
  console.log("\n--- Breakdown By Source ---");
  sourcesRes.rows.forEach(r => console.log(`  - ${r.src}: ${r.count}`));

  // 2. Top Genres
  const genresRes = await rawDb.execute(`
    SELECT g.name, count(gg."A") as count 
    FROM "Genre" g 
    JOIN "_GameToGenre" gg ON gg."B" = g.id 
    JOIN "Game" gm ON gm.id = gg."A" AND (gm.status IS NULL OR gm.status != 'hidden')
    GROUP BY g.name 
    ORDER BY count DESC 
    LIMIT 25
  `);
  console.log("\n--- Top Genres in Catalog ---");
  genresRes.rows.forEach(r => console.log(`  - ${r.name}: ${r.count}`));

  // 3. Top Tags
  const tagsRes = await rawDb.execute(`
    SELECT t.name, count(gt."A") as count 
    FROM "Tag" t 
    JOIN "_GameToTag" gt ON gt."B" = t.id 
    JOIN "Game" gm ON gm.id = gt."A" AND (gm.status IS NULL OR gm.status != 'hidden')
    GROUP BY t.name 
    ORDER BY count DESC 
    LIMIT 35
  `);
  console.log("\n--- Top Tags in Catalog ---");
  tagsRes.rows.forEach(r => console.log(`  - ${r.name}: ${r.count}`));

  // 4. Non-horror sounding checks
  const genresToCheck = ['Sport', 'Racing', 'Music', 'Trivia', 'Pinball', 'Card & Board Game'];
  console.log("\n--- Check for Potentially Non-Horror Genres ---");
  for (const genreName of genresToCheck) {
    const res = await rawDb.execute({
      sql: `
        SELECT count(*) as count 
        FROM "Game" gm
        JOIN "_GameToGenre" gg ON gg."A" = gm.id
        JOIN "Genre" g ON g.id = gg."B"
        WHERE (gm.status IS NULL OR gm.status != 'hidden')
          AND g.name = ?
      `,
      args: [genreName]
    });
    console.log(`  - Genre "${genreName}": ${res.rows[0].count} games`);
  }

  // 5. Sample games with "Sport" or "Racing"
  const sampleNonHorror = await rawDb.execute(`
    SELECT gm.title, gm.slug, g.name as genre, gm.summary 
    FROM "Game" gm
    JOIN "_GameToGenre" gg ON gg."A" = gm.id
    JOIN "Genre" g ON g.id = gg."B"
    WHERE (gm.status IS NULL OR gm.status != 'hidden')
      AND g.name IN ('Sport', 'Racing')
    LIMIT 10
  `);
  console.log("\n--- Sample 10 Games with Sport/Racing ---");
  sampleNonHorror.rows.forEach(r => {
    const desc = r.summary ? (r.summary as string).slice(0, 80).replace(/\n/g, ' ') : 'No summary';
    console.log(`  - "${r.title}" [${r.genre}] -> ${desc}...`);
  });

  // 6. How many games have NO Horror tag/genre?
  const hasHorrorRes = await rawDb.execute(`
    SELECT count(DISTINCT gm.id) as count
    FROM "Game" gm
    LEFT JOIN "_GameToGenre" gg ON gg."A" = gm.id
    LEFT JOIN "Genre" g ON g.id = gg."B" AND lower(g.name) LIKE '%horror%'
    LEFT JOIN "_GameToTag" gt ON gt."A" = gm.id
    LEFT JOIN "Tag" t ON t.id = gt."B" AND (
      lower(t.name) LIKE '%horror%' OR 
      lower(t.name) IN ('psychological horror', 'survival horror', 'dark', 'gore', 'creepy', 'zombies', 'atmospheric', 'mystery')
    )
    WHERE (gm.status IS NULL OR gm.status != 'hidden')
      AND (g.id IS NOT NULL OR t.id IS NOT NULL)
  `);
  console.log(`\n--- Horror Tag/Genre Coverage ---`);
  console.log(`  - Games with explicit 'Horror' or horror sub-tag: ${hasHorrorRes.rows[0].count} / 107567`);

  // 7. Check games with ZERO horror tags or genres - sample them
  const noHorrorSample = await rawDb.execute(`
    SELECT gm.id, gm.title, gm.slug, gm.source, gm.summary, gm."developerNames"
    FROM "Game" gm
    WHERE (gm.status IS NULL OR gm.status != 'hidden')
      AND gm.id NOT IN (
        SELECT DISTINCT gg."A" FROM "_GameToGenre" gg 
        JOIN "Genre" g ON g.id = gg."B" WHERE lower(g.name) LIKE '%horror%'
      )
      AND gm.id NOT IN (
        SELECT DISTINCT gt."A" FROM "_GameToTag" gt 
        JOIN "Tag" t ON t.id = gt."B" WHERE lower(t.name) LIKE '%horror%' OR lower(t.name) IN ('psychological horror', 'survival horror', 'dark', 'gore', 'creepy', 'zombies', 'atmospheric', 'mystery')
      )
    LIMIT 15
  `);
  console.log(`\n--- Sample 15 Games with NO Explicit Horror Genre/Tag ---`);
  noHorrorSample.rows.forEach(r => {
    const desc = r.summary ? (r.summary as string).slice(0, 80).replace(/\n/g, ' ') : 'No summary';
    console.log(`  - "${r.title}" (${r.slug}) [${r.source || 'igdb'}, Dev: ${r.developerNames || 'N/A'}] -> ${desc}...`);
  });

  // 8. Total count of games with NO explicit horror genre/tag
  const noHorrorCount = await rawDb.execute(`
    SELECT count(*) as count
    FROM "Game" gm
    WHERE (gm.status IS NULL OR gm.status != 'hidden')
      AND gm.id NOT IN (
        SELECT DISTINCT gg."A" FROM "_GameToGenre" gg 
        JOIN "Genre" g ON g.id = gg."B" WHERE lower(g.name) LIKE '%horror%'
      )
      AND gm.id NOT IN (
        SELECT DISTINCT gt."A" FROM "_GameToTag" gt 
        JOIN "Tag" t ON t.id = gt."B" WHERE lower(t.name) LIKE '%horror%' OR lower(t.name) IN ('psychological horror', 'survival horror', 'dark', 'gore', 'creepy', 'zombies', 'atmospheric', 'mystery')
      )
  `);
  console.log(`\nTotal games with NO explicit horror genre/tag: ${noHorrorCount.rows[0].count}`);
}

main().catch(console.error);
