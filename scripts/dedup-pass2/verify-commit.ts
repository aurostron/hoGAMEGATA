import "../load-env";
import { rawDb } from "./client";

async function main() {
  console.log("\n==================================================");
  console.log("🔍 PASS 2 POST-COMMIT VERIFICATION");
  console.log("==================================================");

  // 1. Check Total Visible Games
  const countRes = await rawDb.execute(`SELECT count(*) as count FROM "Game" WHERE status IS NULL OR status != 'hidden'`);
  console.log(`Active games in TursoDB: ${countRes.rows[0].count} (Expected: 107567)`);

  // 2. Check Fears to Fathom: Home Alone (Steam + Itch unified)
  const f2fRes = await rawDb.execute(`
    SELECT g.slug, g.title, p."storeName", p.url 
    FROM "Game" g 
    JOIN "PurchaseLink" p ON p."gameId" = g.id 
    WHERE g.slug = 'fears-to-fathom-home-alone--1'
  `);
  console.log(`\nFears to Fathom Links (${f2fRes.rows.length}):`);
  f2fRes.rows.forEach(r => console.log(` - [${r.storeName}] ${r.url}`));

  // 3. Check Dead Space (2008)
  const dsRes = await rawDb.execute(`
    SELECT slug, title, status, "developerNames" 
    FROM "Game" 
    WHERE slug IN ('dead-space', 'dead-space-2008')
  `);
  console.log(`\nDead Space Records:`);
  dsRes.rows.forEach(r => console.log(` - ${r.title} (${r.slug}): status=${r.status}, dev=${r.developerNames}`));

  // 4. Check System Shock (2023)
  const ssRes = await rawDb.execute(`
    SELECT slug, title, status 
    FROM "Game" 
    WHERE slug IN ('system-shock--1', 'system-shock')
  `);
  console.log(`\nSystem Shock Records:`);
  ssRes.rows.forEach(r => console.log(` - ${r.title} (${r.slug}): status=${r.status}`));

  // 5. Check Remakes remain intact (Silent Hill 2)
  const sh2Res = await rawDb.execute(`
    SELECT slug, title, status, "developerNames", "releaseDate" 
    FROM "Game" 
    WHERE title = 'Silent Hill 2' AND (status IS NULL OR status != 'hidden')
  `);
  console.log(`\nSilent Hill 2 Active Records (${sh2Res.rows.length}):`);
  sh2Res.rows.forEach(r => console.log(` - ${r.title} (${r.slug}) [${r.developerNames}]`));

  console.log("\n==================================================\n");
}

main().catch(console.error);
