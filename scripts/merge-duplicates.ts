import "./load-env";
import * as readline from "readline";
import { getSupabaseServer } from "../src/lib/supabaseServer";
import {
  turso,
  schema,
  eq,
  and,
  or,
  like,
  inArray,
  generateId
} from "./db-helper";

const supabase = getSupabaseServer();

function normalizeUrl(url: string): string {
  const norm = url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

  const ignoredDomains = [
    "store.steampowered.com",
    "gog.com",
    "epicgames.com",
    "playstation.com",
    "xbox.com",
    "nintendo.com",
    "itch.io",
    "archive.org"
  ];
  if (ignoredDomains.includes(norm)) {
    return "";
  }
  return norm;
}

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  let selectedMode = "";
  let storeNameArg = "";

  if (args.includes("--all")) {
    selectedMode = "all";
  } else if (args.includes("--itch")) {
    selectedMode = "itch";
  } else {
    const storeIdx = args.indexOf("--store");
    if (storeIdx !== -1 && args[storeIdx + 1]) {
      selectedMode = "store";
      storeNameArg = args[storeIdx + 1].trim();
    }
  }

  if (!selectedMode) {
    console.log("\n==================================================");
    console.log("🧬 DATABASE DUPLICATE RESOLUTION ENGINE");
    console.log("==================================================");
    console.log("1. Scan entire database for duplicates (All stores/platforms)");
    console.log("2. Scan Itch.io games only");
    console.log("3. Scan Custom Store only (e.g. Steam, GOG)");
    console.log("4. Cancel");
    console.log("==================================================");

    const modeChoice = await askQuestion("Select mode [1-4]: ");
    if (modeChoice === "1") {
      selectedMode = "all";
    } else if (modeChoice === "2") {
      selectedMode = "itch";
    } else if (modeChoice === "3") {
      selectedMode = "store";
      storeNameArg = await askQuestion("Enter store name to scan (e.g. Steam, GOG): ");
      if (!storeNameArg) {
        console.log("❌ Store name cannot be empty.");
        process.exit(0);
      }
    } else {
      console.log("👋 Cancelled.");
      process.exit(0);
    }
  }

  let games: any[] = [];
  if (selectedMode === "itch") {
    console.log("🔍 Querying database (Itch.io games only)...");
    games = await turso
      .select()
      .from(schema.games)
      .where(like(schema.games.slug, "itch-%"));
  } else if (selectedMode === "store" && storeNameArg) {
    console.log(`🔍 Querying database (Games containing store: ${storeNameArg})...`);
    const gameIdsResult = await turso
      .select({ gameId: schema.purchaseLinks.gameId })
      .from(schema.purchaseLinks)
      .where(like(schema.purchaseLinks.storeName, `%${storeNameArg}%`));
    const gameIds = gameIdsResult.map(r => r.gameId);
    if (gameIds.length > 0) {
      games = await turso
        .select()
        .from(schema.games)
        .where(inArray(schema.games.id, gameIds));
    }
  } else {
    console.log("🔍 Querying entire database (All games)...");
    games = await turso.select().from(schema.games);
  }

  console.log(`📚 Found ${games.length} games in database matching criteria. Analyzing for duplicates...`);

  // Load all developers and purchase links to attach to games for analysis
  const devRows = await turso
    .select({
      gameId: schema.gamesToDevelopers.gameId,
      id: schema.developers.id,
      name: schema.developers.name,
      slug: schema.developers.slug
    })
    .from(schema.gamesToDevelopers)
    .innerJoin(schema.developers, eq(schema.gamesToDevelopers.developerId, schema.developers.id));

  const linkRows = await turso.select().from(schema.purchaseLinks);

  const devMap = new Map<string, any[]>();
  for (const d of devRows) {
    if (!devMap.has(d.gameId)) devMap.set(d.gameId, []);
    devMap.get(d.gameId)!.push(d);
  }

  const linkMap = new Map<string, any[]>();
  for (const l of linkRows) {
    if (!linkMap.has(l.gameId)) linkMap.set(l.gameId, []);
    linkMap.get(l.gameId)!.push(l);
  }

  // Hydrate local games array
  for (const g of games) {
    g.developers = devMap.get(g.id) || [];
    g.purchaseLinks = linkMap.get(g.id) || [];
  }

  const visitedGameIds = new Set<string>();
  const duplicateGroups: Array<{ games: any[]; reason: string }> = [];

  for (let i = 0; i < games.length; i++) {
    const gameA = games[i];
    if (visitedGameIds.has(gameA.id)) continue;

    const group = [gameA];
    let reason = "";

    const nameANorm = normalizeString(gameA.title);
    const urlsA = gameA.purchaseLinks.map((l: any) => normalizeUrl(l.url)).filter(Boolean);

    for (let j = i + 1; j < games.length; j++) {
      const gameB = games[j];
      if (visitedGameIds.has(gameB.id)) continue;

      const nameBNorm = normalizeString(gameB.title);
      const urlsB = gameB.purchaseLinks.map((l: any) => normalizeUrl(l.url)).filter(Boolean);

      // Check URL overlap
      const sharedUrls = urlsA.filter((u: any) => urlsB.includes(u));
      if (sharedUrls.length > 0) {
        group.push(gameB);
        reason = `Shared URL: ${sharedUrls[0]}`;
        continue;
      }

      // Check name match AND dev match
      if (nameANorm === nameBNorm && nameANorm.length > 2) {
        const devsA = gameA.developers.map((d: any) => d.slug);
        const devsB = gameB.developers.map((d: any) => d.slug);
        const sharedDevs = devsA.filter((d: any) => devsB.includes(d));
        if (sharedDevs.length > 0 || (devsA.length === 0 && devsB.length === 0)) {
          group.push(gameB);
          reason = `Matching titles (${gameA.title}) and developer`;
          continue;
        }
      }
    }

    if (group.length > 1) {
      group.forEach(g => visitedGameIds.add(g.id));
      duplicateGroups.push({ games: group, reason });
    }
  }

  if (duplicateGroups.length === 0) {
    console.log("🎉 No duplicate game groups detected!");
    process.exit(0);
  }

  console.log(`\n🚨 Detected ${duplicateGroups.length} duplicate groups!`);
  let mergedGroupsCount = 0;
  let skippedGroupsCount = 0;

  for (let gIdx = 0; gIdx < duplicateGroups.length; gIdx++) {
    const group = duplicateGroups[gIdx];
    console.log(`\n--------------------------------------------------`);
    console.log(`Group [${gIdx + 1}/${duplicateGroups.length}] - Reason: ${group.reason}`);
    console.log(`--------------------------------------------------`);

    group.games.forEach((game, idx) => {
      const devName = game.developers.map((d: any) => d.name).join(", ") || "Unknown";
      const source = game.source || "Unknown";
      const isEnriched = game.rawgEnriched ? "RAWG-Enriched" : "Skeleton";
      const isScare = game.scareRating !== null ? `Scare-Meter(${game.scareRating})` : "No-Scare";
      console.log(`  [${idx + 1}] Title: "${game.title}"`);
      console.log(`      ID: ${game.id} | Slug: ${game.slug}`);
      console.log(`      Dev: ${devName} | Source: ${source} | ${isEnriched} | ${isScare}`);
      game.purchaseLinks.forEach((l: any) => console.log(`      🔗 Link: [${l.storeName}] ${l.url}`));
    });

    // Recommend the best primary:
    // Non-itch (Steam/GOG) first, then IGDB, then enriched, then with scareRating, then oldest release date/created
    let recommendedPrimary = group.games[0];
    for (const game of group.games) {
      const pSrc = recommendedPrimary.source || "";
      const gSrc = game.source || "";
      
      const pIsItch = pSrc.includes("itch") || recommendedPrimary.slug.startsWith("itch-");
      const gIsItch = gSrc.includes("itch") || game.slug.startsWith("itch-");

      if (pIsItch && !gIsItch) {
        recommendedPrimary = game;
        continue;
      }
      if (!pIsItch && gIsItch) {
        continue;
      }

      if (!recommendedPrimary.rawgEnriched && game.rawgEnriched) {
        recommendedPrimary = game;
        continue;
      }
      if (recommendedPrimary.rawgEnriched && !game.rawgEnriched) {
        continue;
      }

      if (recommendedPrimary.scareRating === null && game.scareRating !== null) {
        recommendedPrimary = game;
        continue;
      }
    }

    console.log(`\n💡 Recommended Primary: [${group.games.indexOf(recommendedPrimary) + 1}] "${recommendedPrimary.title}"`);

    if (dryRun) {
      console.log(`\n[Dry Run] Would merge ${group.games.length - 1} duplicates into: "${recommendedPrimary.title}" (ID: ${recommendedPrimary.id})`);
      continue;
    }

    const answer = await askQuestion(`\nMerge this group? [Y/n/s/index] (Y/Enter = recommended, n/s = skip, or enter 1-${group.games.length} for custom primary): `);
    const ansLower = answer.toLowerCase();

    if (ansLower === "n" || ansLower === "s" || ansLower === "skip" || ansLower === "no") {
      console.log("⏭️ Skipped this group.");
      skippedGroupsCount++;
      continue;
    }

    let primary = recommendedPrimary;
    let customChoiceIdx = parseInt(answer, 10);
    if (!isNaN(customChoiceIdx) && customChoiceIdx >= 1 && customChoiceIdx <= group.games.length) {
      primary = group.games[customChoiceIdx - 1];
      console.log(`👉 Selected custom primary: "${primary.title}"`);
    } else {
      console.log(`👉 Merging into recommended primary: "${primary.title}"`);
    }

    const secondaries = group.games.filter(g => g.id !== primary.id);

    try {
      console.log("🛠️ Merging database records...");

      const primaryDataToUpdate: any = {};

      for (const sec of secondaries) {
        if (!primary.coverUrl && sec.coverUrl) primaryDataToUpdate.coverUrl = sec.coverUrl;
        if (!primary.summary && sec.summary) primaryDataToUpdate.summary = sec.summary;
        if (!primary.storyline && sec.storyline) primaryDataToUpdate.storyline = sec.storyline;
        if (!primary.rating && sec.rating) primaryDataToUpdate.rating = sec.rating;
        if (!primary.releaseDate && sec.releaseDate) primaryDataToUpdate.releaseDate = sec.releaseDate;
        if (!primary.developerNames && sec.developerNames) primaryDataToUpdate.developerNames = sec.developerNames;

        if (!primary.rawgEnriched && sec.rawgEnriched) {
          primaryDataToUpdate.rawgEnriched = true;
          primaryDataToUpdate.rawgRating = sec.rawgRating;
          primaryDataToUpdate.rawgSlug = sec.rawgSlug;
          primaryDataToUpdate.rawgId = sec.rawgId;
          primaryDataToUpdate.lastRawgSync = sec.lastRawgSync;
          primaryDataToUpdate.rawgMetadataHash = sec.rawgMetadataHash;
        }
        if (!primary.scareRating && sec.scareRating) {
          primaryDataToUpdate.scareRating = sec.scareRating;
          primaryDataToUpdate.scareProfile = sec.scareProfile;
          primaryDataToUpdate.scareReviewCount = sec.scareReviewCount;
          primaryDataToUpdate.lastScareSync = sec.lastScareSync;
        }
        if (!primary.protonDbTier && sec.protonDbTier) {
          primaryDataToUpdate.protonDbTier = sec.protonDbTier;
          primaryDataToUpdate.protonDbConfidence = sec.protonDbConfidence;
          primaryDataToUpdate.protonDbScore = sec.protonDbScore;
          primaryDataToUpdate.protonDbTotalReports = sec.protonDbTotalReports;
          primaryDataToUpdate.lastProtonDbSync = sec.lastProtonDbSync;
        }
      }

      if (Object.keys(primaryDataToUpdate).length > 0) {
        await turso
          .update(schema.games)
          .set(primaryDataToUpdate)
          .where(eq(schema.games.id, primary.id));
      }

      for (const sec of secondaries) {
        // A. PurchaseLink
        const secLinks = await turso.select().from(schema.purchaseLinks).where(eq(schema.purchaseLinks.gameId, sec.id));
        const primLinks = await turso.select().from(schema.purchaseLinks).where(eq(schema.purchaseLinks.gameId, primary.id));
        const primUrlsNormalized = primLinks.map(l => normalizeUrl(l.url));

        for (const link of secLinks) {
          if (primUrlsNormalized.includes(normalizeUrl(link.url))) {
            await turso.delete(schema.purchaseLinks).where(eq(schema.purchaseLinks.id, link.id));
          } else {
            await turso
              .update(schema.purchaseLinks)
              .set({ gameId: primary.id })
              .where(eq(schema.purchaseLinks.id, link.id));
          }
        }

        // B. Wishlist (Supabase)
        if (supabase) {
          const { data: secWishlists } = await supabase.from("Wishlist").select().eq("gameId", sec.id);
          if (secWishlists) {
            for (const wishlist of secWishlists) {
              const { data: exists } = await supabase.from("Wishlist").select().eq("userId", wishlist.userId).eq("gameId", primary.id).maybeSingle();
              if (exists) {
                await supabase.from("Wishlist").delete().eq("id", wishlist.id);
              } else {
                await supabase.from("Wishlist").update({ gameId: primary.id }).eq("id", wishlist.id);
              }
            }
          }
        }

        // C. Collection (Supabase)
        if (supabase) {
          const { data: secCollections } = await supabase.from("Collection").select().eq("gameId", sec.id);
          if (secCollections) {
            for (const col of secCollections) {
              const { data: exists } = await supabase.from("Collection").select().eq("userId", col.userId).eq("gameId", primary.id).maybeSingle();
              if (exists) {
                await supabase.from("Collection").delete().eq("id", col.id);
              } else {
                await supabase.from("Collection").update({ gameId: primary.id }).eq("id", col.id);
              }
            }
          }
        }

        // D. PriceSnapshot
        const secSnapshots = await turso.select().from(schema.priceSnapshots).where(eq(schema.priceSnapshots.gameId, sec.id));
        for (const snap of secSnapshots) {
          const [exists] = await turso
            .select()
            .from(schema.priceSnapshots)
            .where(
              and(
                eq(schema.priceSnapshots.gameId, primary.id),
                eq(schema.priceSnapshots.storeName, snap.storeName),
                eq(schema.priceSnapshots.country, snap.country)
              )
            )
            .limit(1);
          if (exists) {
            await turso.delete(schema.priceSnapshots).where(eq(schema.priceSnapshots.id, snap.id));
          } else {
            await turso
              .update(schema.priceSnapshots)
              .set({ gameId: primary.id })
              .where(eq(schema.priceSnapshots.id, snap.id));
          }
        }

        // E. ReferralClick (Supabase)
        if (supabase) {
          await supabase.from("ReferralClick").update({ gameId: primary.id }).eq("gameId", sec.id);
        }

        // F. SearchClick (Supabase)
        if (supabase) {
          await supabase.from("SearchClick").update({ gameId: primary.id }).eq("gameId", sec.id);
        }

        // G. GameRecommendation migrations
        const secRecs = await turso
          .select()
          .from(schema.gameRecommendations)
          .where(
            or(
              eq(schema.gameRecommendations.gameId, sec.id),
              eq(schema.gameRecommendations.recommendedGameId, sec.id)
            )
          );
          
        for (const rec of secRecs) {
          const isSecSource = rec.gameId === sec.id;
          const otherId = isSecSource ? rec.recommendedGameId : rec.gameId;

          if (otherId === primary.id) {
            await turso
              .delete(schema.gameRecommendations)
              .where(
                and(
                  eq(schema.gameRecommendations.gameId, rec.gameId),
                  eq(schema.gameRecommendations.recommendedGameId, rec.recommendedGameId)
                )
              );
            continue;
          }

          const newGameId = isSecSource ? primary.id : otherId;
          const newRecId = isSecSource ? otherId : primary.id;

          const [exists] = await turso
            .select()
            .from(schema.gameRecommendations)
            .where(
              and(
                eq(schema.gameRecommendations.gameId, newGameId),
                eq(schema.gameRecommendations.recommendedGameId, newRecId)
              )
            )
            .limit(1);

          if (exists) {
            await turso
              .delete(schema.gameRecommendations)
              .where(
                and(
                  eq(schema.gameRecommendations.gameId, rec.gameId),
                  eq(schema.gameRecommendations.recommendedGameId, rec.recommendedGameId)
                )
              );
          } else {
            await turso
              .delete(schema.gameRecommendations)
              .where(
                and(
                  eq(schema.gameRecommendations.gameId, rec.gameId),
                  eq(schema.gameRecommendations.recommendedGameId, rec.recommendedGameId)
                )
              );
            await turso
              .insert(schema.gameRecommendations)
              .values({
                gameId: newGameId,
                recommendedGameId: newRecId,
                distance: rec.distance
              });
          }
        }

        // H. Many-to-many associations
        const secDevs = await turso.select().from(schema.gamesToDevelopers).where(eq(schema.gamesToDevelopers.gameId, sec.id));
        for (const d of secDevs) {
          await turso.insert(schema.gamesToDevelopers).values({ gameId: primary.id, developerId: d.developerId }).onConflictDoNothing();
        }
        await turso.delete(schema.gamesToDevelopers).where(eq(schema.gamesToDevelopers.gameId, sec.id));

        const secGenres = await turso.select().from(schema.gamesToGenres).where(eq(schema.gamesToGenres.gameId, sec.id));
        for (const g of secGenres) {
          await turso.insert(schema.gamesToGenres).values({ gameId: primary.id, genreId: g.genreId }).onConflictDoNothing();
        }
        await turso.delete(schema.gamesToGenres).where(eq(schema.gamesToGenres.gameId, sec.id));

        const secTags = await turso.select().from(schema.gamesToTags).where(eq(schema.gamesToTags.gameId, sec.id));
        for (const t of secTags) {
          await turso.insert(schema.gamesToTags).values({ gameId: primary.id, tagId: t.tagId }).onConflictDoNothing();
        }
        await turso.delete(schema.gamesToTags).where(eq(schema.gamesToTags.gameId, sec.id));

        const secPubs = await turso.select().from(schema.gamesToPublishers).where(eq(schema.gamesToPublishers.gameId, sec.id));
        for (const p of secPubs) {
          await turso.insert(schema.gamesToPublishers).values({ gameId: primary.id, publisherId: p.publisherId }).onConflictDoNothing();
        }
        await turso.delete(schema.gamesToPublishers).where(eq(schema.gamesToPublishers.gameId, sec.id));

        const secPlats = await turso.select().from(schema.gamesToPlatforms).where(eq(schema.gamesToPlatforms.gameId, sec.id));
        for (const pl of secPlats) {
          await turso.insert(schema.gamesToPlatforms).values({ gameId: primary.id, platformId: pl.platformId }).onConflictDoNothing();
        }
        await turso.delete(schema.gamesToPlatforms).where(eq(schema.gamesToPlatforms.gameId, sec.id));

        // I. Delete secondary game
        await turso.delete(schema.games).where(eq(schema.games.id, sec.id));
      }

      console.log(`✅ Group merged successfully! Merged ${secondaries.length} games into "${primary.title}" (ID: ${primary.id})`);
      mergedGroupsCount++;
    } catch (err) {
      console.error(`❌ Merge failed for group:`, err);
    }
  }

  console.log(`\n==================================================`);
  console.log(`🏁 Operation Complete`);
  console.log(`==================================================`);
  console.log(`📁 Total Groups Analyzed: ${duplicateGroups.length}`);
  console.log(`✅ Successfully Merged:   ${mergedGroupsCount}`);
  console.log(`⏭️ Skipped/Ignored:       ${skippedGroupsCount}`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("❌ Fatal Error:", err);
  process.exit(1);
});
