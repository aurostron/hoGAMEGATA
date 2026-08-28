import './load-env';
import { turso, schema, asc, or, isNull, ne } from './db-helper';
import * as fs from 'fs';
import * as path from 'path';

async function dump() {
  console.log('Fetching games for raw export...');
  const allGames = await turso
    .select({
      title: schema.games.title,
      slug: schema.games.slug,
      developerNames: schema.games.developerNames,
    })
    .from(schema.games)
    .where(or(isNull(schema.games.status), ne(schema.games.status, 'hidden')))
    .orderBy(asc(schema.games.title));

  console.log("Total games fetched: " + allGames.length);
  const outDir = "c:/Users/bapum/Desktop/Portfolio/project-hgg.github.io";
  
  // 1. Text file: all-games.txt
  console.log("Writing all-games.txt...");
  const txtLines = allGames.map(g => {
    const dev = (g.developerNames || "Unknown").split(",")[0].trim();
    return g.title + " | " + dev + " | https://gamegata.xyz/game/" + g.slug;
  });
  const txtHeader = "# hoGAMEGATA Full Registered Games Catalog (" + allGames.length + " games)\n# Format: Title | Developer | URL\n# Source: https://gamegata.xyz\n\n";
  fs.writeFileSync(path.join(outDir, "all-games.txt"), txtHeader + txtLines.join("\n"), "utf-8");

  // 2. Markdown file: all-games.md
  console.log("Writing all-games.md...");
  const mdHeader = "# hoGAMEGATA — Full Games Catalog\n\nTotal Registered Games: **" + allGames.length.toLocaleString() + "**\n\nSource: [gamegata.xyz](https://gamegata.xyz) | Raw Text: [all-games.txt](https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/all-games.txt)\n\n| # | Game Title | Developer | Link |\n| :--- | :--- | :--- | :--- |\n";
  const mdRows = allGames.map((g, i) => {
    const cleanTitle = (g.title || "").replace(/\|/g, "-");
    const cleanDev = ((g.developerNames || "Unknown").split(",")[0].trim()).replace(/\|/g, "-");
    return "| " + (i + 1) + " | " + cleanTitle + " | " + cleanDev + " | [View](https://gamegata.xyz/game/" + g.slug + ") |";
  });
  fs.writeFileSync(path.join(outDir, "all-games.md"), mdHeader + mdRows.join("\n"), "utf-8");

  console.log("Done raw export!");
}

dump().catch(e => {
  console.error(e);
  process.exit(1);
});
