import "./load-env";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

function getLatestCsv(suffix: string): string | null {
  const dir = path.join(process.cwd(), "scripts", "igdb-dumps");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.includes(suffix));
  if (files.length === 0) return null;
  files.sort((a, b) => b.localeCompare(a));
  return path.join(dir, files[0]);
}

async function main() {
  const gamesFile = getLatestCsv("games.csv");
  if (!gamesFile) {
    console.log("No games CSV found");
    return;
  }
  console.log(`Scanning ${gamesFile} for game IDs...`);
  
  const testIds = new Set([141229, 80668, 50228, 69191, 50229]);
  
  const fileStream = fs.createReadStream(gamesFile);
  const rlStream = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let matchCount = 0;

  for await (const line of rlStream) {
    lineCount++;
    if (lineCount === 1) continue; // skip header
    const cells = line.split(",");
    const gameId = parseInt(cells[0], 10);
    if (testIds.has(gameId)) {
      console.log(`MATCH found at line ${lineCount}: ${line.slice(0, 150)}...`);
      matchCount++;
    }
  }
  console.log(`Total lines checked: ${lineCount}`);
  console.log(`Total matches: ${matchCount}`);
}

main().catch(console.error);
