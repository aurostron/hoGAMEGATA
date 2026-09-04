import "../load-env";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";

function getCleanApiKey(): string {
  const envText = fs.readFileSync(".env", "utf-8");
  const match = envText.match(/GEMINI_API_KEY=([^\r\n]+)/);
  const key = match ? match[1].trim() : process.env.GEMINI_API_KEY || "";
  return key.replace(/^["']|["']$/g, "");
}

interface Verdict {
  id: number;
  title: string;
  shouldMerge: boolean;
  primarySlug: string | null;
  mergeSlug: string | null;
  reason: string;
}

async function main() {
  console.log("\n==================================================");
  console.log("🤖 PASS 2: GEMINI 2.5 FLASH DEEP ARBITRATION (5-POINT RUBRIC)");
  console.log("==================================================");

  const apiKey = getCleanApiKey();
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY missing!");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pass2/data");
  const tasksPath = path.join(dataDir, "arb_tasks.json");
  const tasks: any[] = JSON.parse(fs.readFileSync(tasksPath, "utf-8"));
  console.log(`📋 Total Tasks to Arbitrate: ${tasks.length}`);

  const batchSize = 20;
  const allVerdicts: Verdict[] = [];
  const startTime = Date.now();

  for (let b = 0; b < tasks.length; b += batchSize) {
    const batch = tasks.slice(b, b + batchSize);
    console.log(`\n⏳ Dispatching Batch [${Math.floor(b / batchSize) + 1} / ${Math.ceil(tasks.length / batchSize)}] (${batch.length} items)...`);

    const prompt = `You are a master video game historian and catalog curator.
Your task is to analyze each group of games with matching/similar titles and determine if any of the listings represent the EXACT same video game release that should be merged, OR if they are DISTINCT games that must remain separate.

5-POINT VERIFICATION RUBRIC:
1. Studio Pedigree: Check if developers are the same, or if a studio rebranded (e.g. EA Redwood Shores became Visceral Games).
2. Generational & Platform Era: If games are from different console generations (e.g. 1990s vs 2020s, or PS2 vs PS5), or completely different engines/remakes, DO NOT merge.
3. Content Scope: Demos, Prologues, and standalone Expansion/DLCs (e.g. "Afterbirth" vs "Afterbirth+", Chapter 1 vs Full Game) MUST remain separate.
4. Homonyms: Independent indie games that merely share a common name (e.g. "Inside" 2012 by 9ine vs "Inside" 2016 by Playdead) MUST remain separate.
5. Storefront & Scraper Duplicates: Incomplete duplicate scraper entries or dual-language uploads by the same creator CAN be merged into the richer primary listing.

CANDIDATE GROUPS:
${JSON.stringify(batch, null, 2)}

Respond with ONLY a valid JSON array of objects with the exact schema:
[
  {
    "id": 1,
    "title": "Title",
    "shouldMerge": true or false,
    "primarySlug": "slug of the richer game to keep, or null if shouldMerge is false",
    "mergeSlug": "slug of the redundant duplicate game to merge, or null if shouldMerge is false",
    "reason": "Clear 1-sentence historical rationale"
  }
]`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      const raw = response.text || "";
      const jsonMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) {
        console.error("❌ Failed to parse JSON array from response:", raw.slice(0, 200));
        continue;
      }

      const verdicts: Verdict[] = JSON.parse(jsonMatch[0]);
      allVerdicts.push(...verdicts);

      for (const v of verdicts) {
        if (v.shouldMerge) {
          console.log(`  🟢 [MERGE] "${v.title}": "${v.mergeSlug}" ➔ Merge into "${v.primarySlug}"`);
          console.log(`     Reason: ${v.reason}`);
        } else {
          console.log(`  🛡️ [KEEP SEPARATE] "${v.title}"`);
          console.log(`     Reason: ${v.reason}`);
        }
      }
    } catch (err) {
      console.error("❌ Batch error:", err);
    }
  }

  // Save verdicts
  const outPath = path.join(dataDir, "gemini_pass2_verdicts.json");
  fs.writeFileSync(outPath, JSON.stringify(allVerdicts, null, 2), "utf-8");

  const approvedCount = allVerdicts.filter(v => v.shouldMerge).length;
  const protectedCount = allVerdicts.filter(v => !v.shouldMerge).length;

  console.log(`\n==================================================`);
  console.log(`🏁 PASS 2 GEMINI ARBITRATION SUMMARY`);
  console.log(`==================================================`);
  console.log(`Total Groups Evaluated:   ${allVerdicts.length} / ${tasks.length}`);
  console.log(`🟢 Approved Merges:       ${approvedCount}`);
  console.log(`🛡️ Confirmed Protected:   ${protectedCount}`);
  console.log(`⏱️ Total AI Time:         ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`📁 Saved to:              ${outPath}`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
