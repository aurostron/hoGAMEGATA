import "./load-env";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { MOODS, getMoodTagsForGame } from "./mood-rules";
import {
  turso,
  schema,
  getOrCreateGenre,
  getOrCreatePlatform,
  getOrCreateDeveloper,
  getOrCreateTag,
  saveGame
} from "./db-helper";

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║    Add Custom Mobile Horror Game     ║");
  console.log("╚══════════════════════════════════════╝\n");

  const rl = readline.createInterface({ input, output });

  try {
    const title = await rl.question("🔍 Enter game title (e.g., Slendrina: The Cellar): ");
    if (!title.trim()) {
      console.log("❌ Title cannot be empty.");
      rl.close();
      return;
    }

    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    
    // Check if game already exists
    const [existing] = await turso
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, slug))
      .limit(1);

    if (existing) {
      console.log(`⚠️ A game with the slug "${slug}" already exists: "${existing.title}"`);
      const overwrite = await rl.question("Do you want to overwrite it? (y/N): ");
      if (overwrite.toLowerCase() !== "y") {
        console.log("Cancelled.");
        rl.close();
        return;
      }
    }

    const summary = await rl.question("📝 Enter summary/description (Optional): ");
    const devName = await rl.question("🏢 Enter developer name (Optional): ");
    const releaseDateStr = await rl.question("📅 Enter release year (Optional, e.g. 2014): ");
    const coverUrl = await rl.question("🖼️  Enter cover image URL (Optional): ");
    const playStoreUrl = await rl.question("🤖 Enter Google Play Store URL (Optional): ");
    const appStoreUrl = await rl.question("🍏 Enter Apple App Store URL (Optional): ");

    if (!playStoreUrl.trim() && !appStoreUrl.trim()) {
      console.log("⚠️ Warning: No store URLs provided. The game will still be added.");
    }

    console.log("\n⚙️ Processing metadata...");

    // 1. Resolve Platforms
    const platformIds: string[] = [];
    const platformNamesList: string[] = [];
    
    if (playStoreUrl.trim()) {
      const pId = await getOrCreatePlatform("Android", "android", 34);
      platformIds.push(pId);
      platformNamesList.push("Android");
    }
    if (appStoreUrl.trim()) {
      const pId = await getOrCreatePlatform("iOS", "ios", 39);
      platformIds.push(pId);
      platformNamesList.push("iOS");
    }
    
    // Default to both if neither URL was provided, but ask which platform they target
    if (platformIds.length === 0) {
      const platTarget = await rl.question("Which platform does it target? (1: Both, 2: Android Only, 3: iOS Only) [1]: ");
      if (platTarget === "2") {
        const pId = await getOrCreatePlatform("Android", "android", 34);
        platformIds.push(pId);
        platformNamesList.push("Android");
      } else if (platTarget === "3") {
        const pId = await getOrCreatePlatform("iOS", "ios", 39);
        platformIds.push(pId);
        platformNamesList.push("iOS");
      } else {
        const aId = await getOrCreatePlatform("Android", "android", 34);
        const iId = await getOrCreatePlatform("iOS", "ios", 39);
        platformIds.push(aId, iId);
        platformNamesList.push("Android", "iOS");
      }
    }

    // 2. Resolve Genre (always includes Horror)
    const horrorGenreId = await getOrCreateGenre("Horror", "horror", 19);
    const genreIds = [horrorGenreId];
    const genreNames = "Horror";

    // 3. Resolve Developer
    const developerIds: string[] = [];
    let developerNames = "";
    if (devName.trim()) {
      const devSlug = devName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const dId = await getOrCreateDeveloper(devName.trim(), devSlug);
      developerIds.push(dId);
      developerNames = devName.trim();
    }

    // 4. Resolve Release Date
    let releaseDate: Date | null = null;
    if (releaseDateStr.trim()) {
      const year = parseInt(releaseDateStr.trim(), 10);
      if (!isNaN(year)) {
        releaseDate = new Date(`${year}-01-01`);
      }
    }

    // 5. Purchase/Download Links
    const purchaseLinks: Array<{ storeName: string; url: string }> = [];
    if (playStoreUrl.trim()) {
      purchaseLinks.push({ storeName: "Google Play Store", url: playStoreUrl.trim() });
    }
    if (appStoreUrl.trim()) {
      purchaseLinks.push({ storeName: "Apple App Store", url: appStoreUrl.trim() });
    }

    // 6. Generate Mood tags automatically
    console.log("🏷️  Applying AI/Rule-based vibe tags...");
    const moodTagMap = new Map<string, string>();
    for (const mood of MOODS) {
      const tagId = await getOrCreateTag(mood.name, mood.slug);
      moodTagMap.set(mood.slug, tagId);
    }

    const tagIds: string[] = [];
    const matchedMoods = await getMoodTagsForGame({
      title: title.trim(),
      summary: summary.trim(),
      storyline: "",
      genreNames: ["Horror"],
      keywords: [],
      playerPerspectives: []
    });

    for (const moodSlug of matchedMoods) {
      const tId = moodTagMap.get(moodSlug);
      if (tId) tagIds.push(tId);
    }

    // 7. Save Game
    console.log("💾 Saving game to database...");
    const gameId = await saveGame({
      title: title.trim(),
      slug,
      summary: summary.trim() || null,
      releaseDate,
      status: "released",
      coverUrl: coverUrl.trim() || null,
      developerNames: developerNames || null,
      genreNames,
      platformNames: platformNamesList.join(", "),
      source: "custom-mobile",
      developerIds,
      genreIds,
      platformIds,
      tagIds,
      purchaseLinks
    });

    console.log(`\n✅ Successfully added custom mobile game "${title.trim()}"! (Database ID: ${gameId})`);
  } catch (err: any) {
    console.error("❌ Failed to add custom game:", err.message);
  } finally {
    rl.close();
  }
}

// Helper eq import so we don't crash
import { eq } from "drizzle-orm";

main().catch(console.error);
