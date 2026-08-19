import "dotenv/config";
import fs from "fs";
import path from "path";
import { initTursoForRequest, libsqlClient } from "../src/lib/turso";

async function generateRandomPool() {
  console.log("🎲 Generating static random-games pool...");
  initTursoForRequest(process.env);

  try {
    // Select top 3,000 rich Gamegata horror games (rated or enriched with covers and details)
    const res = await libsqlClient.execute(`
      SELECT slug, title, coverUrl, rating, releaseDate
      FROM Game 
      WHERE (status IS NULL OR status != 'hidden')
      AND slug IS NOT NULL
      AND (source IS NULL OR source != 'itch' OR trailerUrl IS NOT NULL OR screenshots IS NOT NULL)
      AND (coverUrl IS NOT NULL OR rating IS NOT NULL)
      ORDER BY rating DESC, likesCount DESC, releaseDate DESC
      LIMIT 3000;
    `);

    const games = res.rows.map(row => ({
      slug: String(row.slug),
      title: String(row.title || ""),
    })).filter(g => g.slug && g.title);

    console.log(`✅ Loaded ${games.length} curated Gamegata games.`);

    const publicDataDir = path.resolve(process.cwd(), "public/data");
    if (!fs.existsSync(publicDataDir)) {
      fs.mkdirSync(publicDataDir, { recursive: true });
    }

    const outputPath = path.join(publicDataDir, "random-pool.json");
    fs.writeFileSync(outputPath, JSON.stringify(games));
    console.log(`💾 Saved to ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);

    const srcDataDir = path.resolve(process.cwd(), "src/data");
    if (!fs.existsSync(srcDataDir)) {
      fs.mkdirSync(srcDataDir, { recursive: true });
    }

    const tsOutputPath = path.join(srcDataDir, "randomPool.ts");
    const top200 = games.slice(0, 200);
    const tsContent = `// Pre-bundled top 200 horror games for instant 0ms offline random discovery
export interface RandomGameItem {
  slug: string;
  title: string;
}

export const FALLBACK_RANDOM_GAMES: RandomGameItem[] = ${JSON.stringify(top200, null, 2)};
`;
    fs.writeFileSync(tsOutputPath, tsContent);
    console.log(`💾 Saved fallback bundle to ${tsOutputPath}`);
  } catch (err) {
    console.error("❌ Failed to generate random pool:", err);
  }
}

generateRandomPool();
