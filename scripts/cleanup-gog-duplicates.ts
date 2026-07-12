import "./load-env";
import {
  turso,
  schema,
  eq,
  inArray,
  and,
  or,
  like
} from "./db-helper";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface SuffixMatch {
  regex: RegExp;
  type: string;
}

const suffixMap: SuffixMatch[] = [
  { regex: /\s*[-–—:]\s*(original\s+soundtrack|soundtrack|ost)\b/i, type: "Soundtrack" },
  { regex: /\s+(original\s+soundtrack|soundtrack|ost)\b/i, type: "Soundtrack" },
  
  { regex: /\s*[-–—:]\s*(digital\s+deluxe\s+edition|deluxe\s+edition|goty\s+edition|game\s+of\s+the\s+year\s+edition|complete\s+edition)\b/i, type: "Deluxe Edition" },
  { regex: /\s+(digital\s+deluxe\s+edition|deluxe\s+edition|goty\s+edition|game\s+of\s+the\s+year\s+edition|complete\s+edition)\b/i, type: "Deluxe Edition" },
  
  { regex: /\s*[-–—:]\s*(deluxe\s+upgrade\s+pack|deluxe\s+upgrade|upgrade\s+pack|skin\s+pack|skin|dlc|add-on|addon|expansion|season\s+pass|pass|upgrade)\b/i, type: "DLC / Add-on" },
  { regex: /\s+(deluxe\s+upgrade\s+pack|deluxe\s+upgrade|upgrade\s+pack|skin\s+pack|skin|dlc|add-on|addon|expansion|season\s+pass|pass|upgrade)\b/i, type: "DLC / Add-on" },
  
  { regex: /\s*[-–—:]\s*(official\s+artbook|artbook|art\s+book|photobook|coloring\s+book|wallpaper\s+pack|wallpapers|artwork|posters|companion|cookbook|official\s+companion|official\s+cookbook)\b/i, type: "Companion Asset" },
  { regex: /\s+(official\s+artbook|artbook|art\s+book|photobook|coloring\s+book|wallpaper\s+pack|wallpapers|artwork|posters|companion|cookbook|official\s+companion|official\s+cookbook)\b/i, type: "Companion Asset" },
  
  { regex: /\s*[-–—:]\s*(demo)\b/i, type: "Demo" },
  { regex: /\s+(demo)\b/i, type: "Demo" }
];

export function extractBaseTitle(title: string): { baseTitle: string; itemType: string | null } {
  for (const item of suffixMap) {
    if (item.regex.test(title)) {
      const baseTitle = title.replace(item.regex, "").trim();
      if (baseTitle.length > 0) {
        return { baseTitle, itemType: item.type };
      }
    }
  }
  return { baseTitle: title, itemType: null };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(`\n==================================================`);
  console.log(`🧹 GOG COMPANION & DUPLICATE CLEANUP ENGINE`);
  console.log(`==================================================`);
  console.log(`🔍 Dry Run: ${dryRun ? "YES (No DB changes)" : "NO (Live updates)"}`);
  console.log(`==================================================\n`);

  console.log("📡 Querying all games from database...");
  const allGames = await turso.select().from(schema.games);
  console.log(`✅ Loaded ${allGames.length} games.`);

  // Create lookup maps for fast matching
  const gamesByTitle = new Map<string, any>();
  const gamesBySlug = new Map<string, any>();
  for (const g of allGames) {
    gamesByTitle.set(g.title.toLowerCase(), g);
    gamesBySlug.set(g.slug, g);
  }

  let mergedCount = 0;
  let deletedOrphanCount = 0;
  let renamedCount = 0;
  let processedCount = 0;

  for (const game of allGames) {
    const { baseTitle, itemType } = extractBaseTitle(game.title);
    if (!itemType) continue; // Skip normal games

    processedCount++;
    const baseTitleLower = baseTitle.toLowerCase();
    const baseSlug = slugify(baseTitle);

    // Try to find the parent game in the DB
    let parentGame = gamesByTitle.get(baseTitleLower) || gamesBySlug.get(baseSlug);

    // Safety: ensure parent game is not the auxiliary game itself
    if (parentGame && parentGame.id === game.id) {
      parentGame = null;
    }

    if (parentGame) {
      console.log(`\n🔗 [MERGE] "${game.title}" ➡️ "${parentGame.title}" (${itemType})`);
      
      if (!dryRun) {
        // A. Fetch auxiliary game purchase links
        const auxLinks = await turso
          .select()
          .from(schema.purchaseLinks)
          .where(eq(schema.purchaseLinks.gameId, game.id));

        for (const link of auxLinks) {
          const formattedStore = `${link.storeName} (${itemType})`;
          
          // Check if parent game already has a link with this URL
          const [exists] = await turso
            .select()
            .from(schema.purchaseLinks)
            .where(
              and(
                eq(schema.purchaseLinks.gameId, parentGame.id),
                eq(schema.purchaseLinks.url, link.url)
              )
            )
            .limit(1);

          if (exists) {
            // Delete duplicate link
            await turso
              .delete(schema.purchaseLinks)
              .where(eq(schema.purchaseLinks.id, link.id));
          } else {
            // Move link to parent and rename storeName
            await turso
              .update(schema.purchaseLinks)
              .set({
                gameId: parentGame.id,
                storeName: formattedStore
              })
              .where(eq(schema.purchaseLinks.id, link.id));
          }
        }

        // B. Fetch auxiliary game price snapshots
        const auxPrices = await turso
          .select()
          .from(schema.priceSnapshots)
          .where(eq(schema.priceSnapshots.gameId, game.id));

        for (const price of auxPrices) {
          const formattedStore = `${price.storeName} (${itemType})`;

          // Check if parent game already has a snapshot with this deal URL, country, and storeName
          const [exists] = await turso
            .select()
            .from(schema.priceSnapshots)
            .where(
              and(
                eq(schema.priceSnapshots.gameId, parentGame.id),
                eq(schema.priceSnapshots.dealUrl, price.dealUrl),
                eq(schema.priceSnapshots.country, price.country)
              )
            )
            .limit(1);

          if (exists) {
            // Delete duplicate price snapshot
            await turso
              .delete(schema.priceSnapshots)
              .where(eq(schema.priceSnapshots.id, price.id));
          } else {
            // Move price snapshot to parent and rename storeName
            await turso
              .update(schema.priceSnapshots)
              .set({
                gameId: parentGame.id,
                storeName: formattedStore
              })
              .where(eq(schema.priceSnapshots.id, price.id));
          }
        }

        // C. Delete auxiliary game and all its relation rows
        await turso.delete(schema.gamesToGenres).where(eq(schema.gamesToGenres.gameId, game.id));
        await turso.delete(schema.gamesToPlatforms).where(eq(schema.gamesToPlatforms.gameId, game.id));
        await turso.delete(schema.gamesToTags).where(eq(schema.gamesToTags.gameId, game.id));
        await turso.delete(schema.gamesToDevelopers).where(eq(schema.gamesToDevelopers.gameId, game.id));
        await turso.delete(schema.gamesToPublishers).where(eq(schema.gamesToPublishers.gameId, game.id));
        await turso.delete(schema.games).where(eq(schema.games.id, game.id));
      }
      mergedCount++;

    } else {
      // Parent game not found
      const isPlayableEdition = itemType === "Deluxe Edition";
      
      if (isPlayableEdition) {
        console.log(`\n🏷️ [RENAME] "${game.title}" ➡️ "${baseTitle}"`);
        
        if (!dryRun) {
          await turso
            .update(schema.games)
            .set({
              title: baseTitle,
              slug: baseSlug,
              updatedAt: new Date()
            })
            .where(eq(schema.games.id, game.id));
        }
        renamedCount++;
      } else {
        console.log(`\n❌ [DELETE] Orphan auxiliary asset: "${game.title}"`);
        
        if (!dryRun) {
          // Delete all relation rows and the game itself
          await turso.delete(schema.purchaseLinks).where(eq(schema.purchaseLinks.gameId, game.id));
          await turso.delete(schema.priceSnapshots).where(eq(schema.priceSnapshots.gameId, game.id));
          await turso.delete(schema.gamesToGenres).where(eq(schema.gamesToGenres.gameId, game.id));
          await turso.delete(schema.gamesToPlatforms).where(eq(schema.gamesToPlatforms.gameId, game.id));
          await turso.delete(schema.gamesToTags).where(eq(schema.gamesToTags.gameId, game.id));
          await turso.delete(schema.gamesToDevelopers).where(eq(schema.gamesToDevelopers.gameId, game.id));
          await turso.delete(schema.gamesToPublishers).where(eq(schema.gamesToPublishers.gameId, game.id));
          await turso.delete(schema.games).where(eq(schema.games.id, game.id));
        }
        deletedOrphanCount++;
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`✅ DUPLICATE CLEANUP RUN COMPLETE`);
  console.log(`==================================================`);
  console.log(`Auxiliary titles detected:  ${processedCount}`);
  console.log(`Merged into parent games:   ${mergedCount}`);
  console.log(`Orphan assets deleted:      ${deletedOrphanCount}`);
  console.log(`Playable editions renamed:  ${renamedCount}`);
  console.log(`==================================================\n`);
}

main().catch(console.error);
