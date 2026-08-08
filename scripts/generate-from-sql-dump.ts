import * as fs from "fs";
import * as path from "path";

function escapeVueMarkdown(str: string): string {
  if (!str) return "";
  return str
    .replace(/\|/g, "\\|")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeYamlString(str: string): string {
  if (!str) return '""';
  return JSON.stringify(str);
}

function cleanAnchorId(slug: string, title: string): string {
  return slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

interface GameEntry {
  title: string;
  slug: string;
  developerNames?: string;
  releaseDate?: number | string | null;
  status?: string;
  igdbId?: number | null;
}

/**
 * Parses Turso SQL dump file (dump.sql) or extracts game entries directly
 */
function parseSqlDump(sqlPath: string): GameEntry[] {
  console.log(`📖 Parsing SQL dump file: ${sqlPath}...`);
  const content = fs.readFileSync(sqlPath, "utf-8");
  const games: GameEntry[] = [];

  const insertRegex = /INSERT INTO (?:` Game `|"Game"|Game) VALUES\s*\((.*?)\);/gi;
  let match: RegExpExecArray | null;

  while ((match = insertRegex.exec(content)) !== null) {
    const rawRow = match[1];
    const values: string[] = [];
    let current = "";
    let inString = false;

    for (let i = 0; i < rawRow.length; i++) {
      const char = rawRow[i];
      if (char === "'" && (i === 0 || rawRow[i - 1] !== "\\")) {
        inString = !inString;
      } else if (char === "," && !inString) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length >= 4) {
      const cleanVal = (v: string) => v.replace(/^'|'$/g, "").replace(/\\'/g, "'");
      const igdbVal = parseInt(values[1], 10);
      const title = cleanVal(values[2] || "");
      const slug = cleanVal(values[3] || "");
      const status = cleanVal(values[7] || "");
      const devName = values[63] ? cleanVal(values[63]) : "";

      if (title && slug && status !== "hidden") {
        games.push({
          title,
          slug,
          developerNames: devName,
          status,
          igdbId: !isNaN(igdbVal) && igdbVal > 0 ? igdbVal : null,
        });
      }
    }
  }

  return games;
}

export function generateVitepressPages(games: GameEntry[]) {
  console.log(`⚡ Processing ${games.length} clean game entries with monochrome white theme & no emojis...`);

  // Sort alphabetically by title
  games.sort((a, b) => a.title.localeCompare(b.title));

  const outputDir = path.join(process.cwd(), "vitepress-index", "docs");
  const directoryDir = path.join(outputDir, "directory");
  const publicDir = path.join(outputDir, "public");
  const gamesDir = path.join(outputDir, "game");

  if (fs.existsSync(gamesDir)) {
    fs.rmSync(gamesDir, { recursive: true, force: true });
    console.log("🧹 Cleaned up old individual game pages.");
  }

  fs.mkdirSync(directoryDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  // 1. Generate search-index.json for direct title & developer search modal
  console.log("🔍 Writing search-index.json...");
  const searchIndexData = games.map((g) => ({
    t: g.title,
    s: cleanAnchorId(g.slug, g.title),
    d: (g.developerNames || "Unknown").split(",")[0].trim(),
    g: g.igdbId ? 1 : 0,
  }));
  fs.writeFileSync(path.join(publicDir, "search-index.json"), JSON.stringify(searchIndexData), "utf-8");

  const groups: Record<string, GameEntry[]> = {};
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  
  groups["0-9"] = [];
  for (const char of alphabet) {
    groups[char] = [];
  }

  const developerMap = new Map<string, number>();

  for (const game of games) {
    const title = game.title.trim();
    if (!title) continue;

    if (game.developerNames) {
      const devs = game.developerNames.split(",").map(d => d.trim()).filter(Boolean);
      for (const dev of devs) {
        developerMap.set(dev, (developerMap.get(dev) || 0) + 1);
      }
    }

    const firstChar = title.charAt(0).toUpperCase();
    if (/[A-Z]/.test(firstChar)) {
      groups[firstChar].push(game);
    } else {
      groups["0-9"].push(game);
    }
  }

  const activeKeys = ["0-9", ...alphabet].filter(key => groups[key] && groups[key].length > 0);
  const nowStr = new Date().toISOString().split("T")[0];

  // 2. Generate Home index.md
  console.log("📝 Generating index.md...");
  const homeContent = `---
layout: home

hero:
  name: "hoGAMEGATA"
  text: "Index Mirror & Directory"
  tagline: "A backed-up static index copy of all ${games.length.toLocaleString()} games registered on hoGAMEGATA."
  actions:
    - theme: brand
      text: Browse Directory (A-Z)
      link: /directory/A
    - theme: alt
      text: Main Site (gamegata.xyz)
      link: https://gamegata.xyz

features:
  - title: Total Games
    details: "${games.length.toLocaleString()} horror games indexed."
  - title: 100% Static Mirror
    details: "Ultra-fast, zero-server index generated from database."
  - title: Direct Game Search
    details: "Search any game title directly and jump to its exact row."
---

## Directory Navigation

Jump directly to any letter in the directory index:

| Category | Letters |
| :--- | :--- |
| **Numbers** | [0-9](/directory/0-9) |
| **A – G** | [A](/directory/A) \| [B](/directory/B) \| [C](/directory/C) \| [D](/directory/D) \| [E](/directory/E) \| [F](/directory/F) \| [G](/directory/G) |
| **H – N** | [H](/directory/H) \| [I](/directory/I) \| [J](/directory/J) \| [K](/directory/K) \| [L](/directory/L) \| [M](/directory/M) \| [N](/directory/N) |
| **O – U** | [O](/directory/O) \| [P](/directory/P) \| [Q](/directory/Q) \| [R](/directory/R) \| [S](/directory/S) \| [T](/directory/T) \| [U](/directory/U) |
| **V – Z** | [V](/directory/V) \| [W](/directory/W) \| [X](/directory/X) \| [Y](/directory/Y) \| [Z](/directory/Z) |

---

- **Total Developers:** ${developerMap.size.toLocaleString()}
- **Last Sync:** ${nowStr}
- **Original Source:** [gamegata.xyz](https://gamegata.xyz/directory)
`;

  fs.writeFileSync(path.join(outputDir, "index.md"), homeContent, "utf-8");

  // 3. Generate Clean Tabular Directory Files with CSS-styled Logo Class Links
  console.log("📝 Generating tabular directory pages without emojis...");

  for (const key of activeKeys) {
    const list = groups[key];
    const prevKey = activeKeys[activeKeys.indexOf(key) - 1] || activeKeys[activeKeys.length - 1];
    const nextKey = activeKeys[activeKeys.indexOf(key) + 1] || activeKeys[0];

    let pageMarkdown = `---
title: ${safeYamlString(`Games — ${key} - hoGAMEGATA Index Mirror`)}
description: ${safeYamlString(`Alphabetical index of horror games starting with ${key} (${list.length} games).`)}
---

# Games — ${key}

**Total Games:** ${list.length.toLocaleString()} | [Previous (${prevKey})](/directory/${prevKey}) | [Next (${nextKey})](/directory/${nextKey})

---

| Game Title | Developer | Links |
| :--- | :--- | :---: |
`;

    for (const game of list) {
      const titleClean = escapeVueMarkdown(game.title);
      const devClean = escapeVueMarkdown((game.developerNames || "Unknown").split(",")[0]);
      const anchor = cleanAnchorId(game.slug, game.title);
      
      const hggLink = `<a href="https://gamegata.xyz/game/${game.slug}" target="_blank" class="link-hgg" title="View on hoGAMEGATA">HGG</a>`;
      const igdbUrl = `https://www.igdb.com/search?q=${encodeURIComponent(game.title)}`;
      const igdbLink = game.igdbId ? ` <a href="${igdbUrl}" target="_blank" class="link-igdb" title="View on IGDB">IGDB</a>` : "";

      pageMarkdown += `| <a id="${anchor}" class="game-target"></a>**${titleClean}** | ${devClean} | ${hggLink}${igdbLink} |\n`;
    }

    pageMarkdown += `\n---\n\n*Jump to section:* [0-9](/directory/0-9) | ` +
      alphabet.map(c => activeKeys.includes(c) ? `[${c}](/directory/${c})` : `${c}`).join(" | ");

    fs.writeFileSync(path.join(directoryDir, `${key}.md`), pageMarkdown, "utf-8");
  }

  // 4. Generate Developers Page
  console.log("📝 Generating developers.md...");
  const sortedDevs = Array.from(developerMap.entries()).sort((a, b) => b[1] - a[1]);
  let devsMarkdown = `---
title: ${safeYamlString("Developers Index - hoGAMEGATA Index Mirror")}
description: ${safeYamlString("Index of game developers registered on hoGAMEGATA.")}
---

# Developers Index (${developerMap.size.toLocaleString()} Total)

Below are top developers indexed on hoGAMEGATA sorted by title count:

| Developer | Total Games |
| :--- | :---: |
`;

  for (const [devName, count] of sortedDevs.slice(0, 500)) {
    const devClean = escapeVueMarkdown(devName);
    devsMarkdown += `| **${devClean}** | ${count} |\n`;
  }

  if (sortedDevs.length > 500) {
    devsMarkdown += `\n*Showing top 500 developers out of ${sortedDevs.length.toLocaleString()} total.*\n`;
  }

  fs.writeFileSync(path.join(outputDir, "developers.md"), devsMarkdown, "utf-8");

  console.log("🎉 Complete! Directory generated with monochrome white theme & no emojis.");
}

async function main() {
  const sqlDumpPath = path.join(process.cwd(), "dump.sql");
  const localDumpPath = path.join(process.cwd(), "vitepress-index", "dump.sql");

  let targetSql = "";
  if (fs.existsSync(sqlDumpPath)) {
    targetSql = sqlDumpPath;
  } else if (fs.existsSync(localDumpPath)) {
    targetSql = localDumpPath;
  }

  if (targetSql) {
    const games = parseSqlDump(targetSql);
    generateVitepressPages(games);
  } else {
    console.log("ℹ️ No dump.sql file found. Running via database helper...");
    const { turso, schema, asc, or, isNull, ne } = await import("./db-helper");
    const allGames = await turso
      .select({
        title: schema.games.title,
        slug: schema.games.slug,
        developerNames: schema.games.developerNames,
        status: schema.games.status,
        igdbId: schema.games.igdbId,
      })
      .from(schema.games)
      .where(or(isNull(schema.games.status), ne(schema.games.status, "hidden")))
      .orderBy(asc(schema.games.title));

    generateVitepressPages(allGames as GameEntry[]);
  }
}

main().catch(err => {
  console.error("❌ Generator error:", err);
  process.exit(1);
});
