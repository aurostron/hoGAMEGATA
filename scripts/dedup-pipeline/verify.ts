import { rawDb } from "./client";

async function verify() {
  console.log("\n==================================================");
  console.log("🔍 POST-MERGE DATABASE VERIFICATION");
  console.log("==================================================");

  const countRes = await rawDb.execute(`
    SELECT count(*) as cnt
    FROM "Game"
    WHERE status IS NULL OR status != 'hidden'
  `);
  console.log("🎮 Active Visible Games in TursoDB:", countRes.rows[0].cnt);

  const hiddenRes = await rawDb.execute(`
    SELECT count(*) as cnt
    FROM "Game"
    WHERE status = 'hidden'
  `);
  console.log("🙈 Soft-Hidden Merged Games in TursoDB:", hiddenRes.rows[0].cnt);

  // Check FAITH
  const faith = await rawDb.execute(`
    SELECT id, slug, title, status FROM "Game" WHERE slug IN ('faith', 'itch-faith')
  `);
  console.log("\nFaith Games Status:");
  console.table(faith.rows);

  const faithLinks = await rawDb.execute(`
    SELECT p.storeName, p.url
    FROM "PurchaseLink" p
    JOIN "Game" g ON p.gameId = g.id
    WHERE g.slug = 'faith'
  `);
  console.log("FAITH Unified Purchase Links:");
  console.table(faithLinks.rows);

  // Check Alone in the Dark
  const alone = await rawDb.execute(`
    SELECT id, slug, title, status
    FROM "Game"
    WHERE slug LIKE 'alone-in-the-dark-the-new-nightmare%'
  `);
  console.log("\nAlone in the Dark Status:");
  console.table(alone.rows);

  const aloneLinks = await rawDb.execute(`
    SELECT g.slug, p.storeName, p.url
    FROM "PurchaseLink" p
    JOIN "Game" g ON p.gameId = g.id
    WHERE g.slug LIKE 'alone-in-the-dark-the-new-nightmare%'
  `);
  console.log("Alone in the Dark Purchase Links:");
  console.table(aloneLinks.rows);

  // Check Silent Hill 2
  const sh2 = await rawDb.execute(`
    SELECT id, slug, title, developerNames, status
    FROM "Game"
    WHERE slug LIKE 'silent-hill-2%'
  `);
  console.log("\nSilent Hill 2 Protected Records:");
  console.table(sh2.rows);

  console.log("==================================================\n");
}

verify().catch(console.error);
