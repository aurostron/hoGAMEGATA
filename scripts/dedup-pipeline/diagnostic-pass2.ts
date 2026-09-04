import { rawDb } from "./client";

async function main() {
  console.log("\n==================================================");
  console.log("🔍 PASS 2 DIAGNOSTIC: CURRENT DATABASE STATE");
  console.log("==================================================");

  // 1. Total games
  const totalRes = await rawDb.execute(`
    SELECT count(*) as cnt
    FROM "Game"
    WHERE (status IS NULL OR status != 'hidden')
  `);
  console.log("🎮 Total Active Visible Games:", totalRes.rows[0].cnt);

  // 2. Exact Title Collisions
  const exactGroups = await rawDb.execute(`
    SELECT lower(trim(title)) as norm_title, count(*) as cnt
    FROM "Game"
    WHERE (status IS NULL OR status != 'hidden')
    GROUP BY lower(trim(title))
    HAVING cnt > 1
    ORDER BY cnt DESC
  `);
  console.log(`\nExact Title Duplicate Groups Remaining: ${exactGroups.rows.length}`);
  const totalInExact = exactGroups.rows.reduce((sum, r: any) => sum + Number(r.cnt), 0);
  console.log(`Games in exact duplicate groups: ${totalInExact}`);

  // Top 10
  console.log("\nTop 10 Remaining Title Groups by count:");
  exactGroups.rows.slice(0, 10).forEach((r: any) => {
    console.log(`  - "${r.norm_title}": ${r.cnt} listings`);
  });

  // 3. Normalized alphanumeric title collisions (stripping punctuation like colons, dashes, etc.)
  // e.g. "Silent Hill 2: Restless Dreams" vs "Silent Hill 2 - Restless Dreams"
  // Let's check a sample
  console.log("==================================================\n");
}

main().catch(console.error);
