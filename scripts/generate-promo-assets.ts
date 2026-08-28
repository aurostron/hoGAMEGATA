import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] || "";
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
      }
    }
  }
}
loadEnv();

async function main() {
  const { turso } = await import("../src/lib/turso");
  const { tags: tagsTable, games: gamesTable } = await import("../src/db/schema");
  const { isNotNull, sql } = await import("drizzle-orm");

  console.log("1. Fetching all tags from database...");
  const tagRows = await turso
    .select({ name: tagsTable.name, slug: tagsTable.slug })
    .from(tagsTable)
    .orderBy(tagsTable.name);

  console.log(`Found ${tagRows.length} tags.`);

  // Write all-tags.txt to project-hgg repo
  const hggRepoPath = path.resolve("..", "project-hgg.github.io");
  const tagHeader = `# hoGAMEGATA Full Verified Horror Tags (${tagRows.length} tags)\n# Format: Tag Name | Slug\n# Source: https://gamegata.xyz\n\n`;
  const tagLines = tagRows.map(t => `${t.name} | ${t.slug}`).join("\n");
  const allTagsTxtContent = tagHeader + tagLines + "\n";

  const hggAllTagsPath = path.join(hggRepoPath, "all-tags.txt");
  if (fs.existsSync(hggRepoPath)) {
    fs.writeFileSync(hggAllTagsPath, allTagsTxtContent, "utf-8");
    console.log(`Wrote ${hggAllTagsPath} (${(allTagsTxtContent.length / 1024).toFixed(1)} KB)`);
  }

  // Also write all-tags.txt to gamegata-astro/public/
  const publicTagsPath = path.resolve("public", "all-tags.txt");
  fs.writeFileSync(publicTagsPath, allTagsTxtContent, "utf-8");
  console.log(`Wrote ${publicTagsPath}`);

  console.log("2. Fetching games with screenshots for slideshow...");
  const gameRows = await turso
    .select({
      title: gamesTable.title,
      developerNames: gamesTable.developerNames,
      screenshots: gamesTable.screenshots,
      coverUrl: gamesTable.coverUrl,
    })
    .from(gamesTable)
    .where(isNotNull(gamesTable.screenshots))
    .limit(300);

  const validGames: { url: string; gameName: string; devName: string }[] = [];
  for (const g of gameRows) {
    if (!g.screenshots) continue;
    try {
      const parsed = JSON.parse(g.screenshots);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === "string" && first.startsWith("http")) {
          // Normalize IGDB screenshot URLs to huge
          const normalized = first.replace(/t_screenshot_med|t_thumb|t_cover_big/, "t_screenshot_huge");
          validGames.push({
            url: normalized,
            gameName: g.title,
            devName: g.developerNames || "Independent Developer"
          });
        }
      }
    } catch {}
  }

  console.log(`Extracted ${validGames.length} valid screenshots.`);

  // Shuffle and pick 50
  const shuffled = validGames.sort(() => 0.5 - Math.random()).slice(0, 50);

  // Write to src/data/promo-screenshots.json
  const dataDir = path.resolve("src", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outJsonPath = path.join(dataDir, "promo-screenshots.json");
  fs.writeFileSync(outJsonPath, JSON.stringify(shuffled, null, 2), "utf-8");
  console.log(`Wrote ${shuffled.length} screenshots to ${outJsonPath}`);
}

main().catch(err => {
  console.error("Error in generate-promo-assets:", err);
  process.exit(1);
});