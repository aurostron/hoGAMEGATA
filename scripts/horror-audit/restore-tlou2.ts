import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { rawDb } from "./client";

async function main() {
  const tlouId = "cmpwg436f00bng4egdt2sz0p0";
  console.log("Restoring The Last of Us Part II (ID:", tlouId, ")...");

  const scareProfile = {
    dread: 88,
    jumpscare: 75,
    psychological: 89,
    gore: 92,
    tension: 94,
    disturbing: 86,
    isolation: 72,
    shortSummary: "A harrowing journey through post-apocalyptic ruin featuring intense stalker stealth, visceral infected encounters, and the grotesque body horror of the Rat King mutation.",
    playerWarnings: [
      "Severe gore and graphic violence",
      "Intense stalker jumpscares",
      "Visceral body horror mutations (Rat King)",
      "Heavy psychological trauma"
    ],
    subFeelings: [
      "body-horror",
      "survival-horror",
      "stalker-tension",
      "visceral-gore",
      "post-apocalyptic-dread"
    ]
  };

  await rawDb.execute({
    sql: `UPDATE "Game" SET status = 'released', "scareRating" = 84, "scareProfile" = ?, "redditUrl" = ?, "lastScareSync" = unixepoch(), "updatedAt" = unixepoch() WHERE id = ?`,
    args: [
      JSON.stringify(scareProfile),
      "https://www.reddit.com/r/thelastofus/comments/he701l/the_horror_elements_in_the_last_of_us_part_2_are",
      tlouId
    ],
  });

  console.log("✅ The Last of Us Part II successfully restored to 'released' and enriched as horror-adjacent (Scare Score 84/100)!");

  // Clean from pass2_hidden_log.json
  const hiddenLogPath = path.resolve(process.cwd(), "scripts/horror-audit/data/pass2_hidden_log.json");
  if (fs.existsSync(hiddenLogPath)) {
    const logs = JSON.parse(fs.readFileSync(hiddenLogPath, "utf-8"));
    const updatedLogs = logs.filter((l: any) => l.id !== tlouId);
    fs.writeFileSync(hiddenLogPath, JSON.stringify(updatedLogs, null, 2));
    console.log("✅ Removed from pass2_hidden_log.json.");
  }
}

main().catch(console.error);
