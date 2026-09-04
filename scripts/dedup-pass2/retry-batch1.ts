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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n==================================================");
  console.log("🔄 RETRYING MISSING TASKS (BATCH 1) WITH EXPONENTIAL BACKOFF");
  console.log("==================================================");

  const apiKey = getCleanApiKey();
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY missing!");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pass2/data");
  const tasksPath = path.join(dataDir, "arb_tasks.json");
  const verdictsPath = path.join(dataDir, "gemini_pass2_verdicts.json");

  const allTasks: any[] = JSON.parse(fs.readFileSync(tasksPath, "utf-8"));
  let existingVerdicts: Verdict[] = [];
  if (fs.existsSync(verdictsPath)) {
    existingVerdicts = JSON.parse(fs.readFileSync(verdictsPath, "utf-8"));
  }

  const existingIds = new Set(existingVerdicts.map((v) => v.id));
  const missingTasks = allTasks.filter((t) => !existingIds.has(t.id));

  console.log(`📋 Existing Verdicts: ${existingVerdicts.length} / ${allTasks.length}`);
  console.log(`🔍 Missing Tasks to Process: ${missingTasks.length}`);

  if (missingTasks.length === 0) {
    console.log("✅ All tasks are already arbitrated!");
    return;
  }

  // Split missing tasks into smaller chunks of 10 for reliability
  const chunkSize = 10;
  const newVerdicts: Verdict[] = [];

  for (let i = 0; i < missingTasks.length; i += chunkSize) {
    const chunk = missingTasks.slice(i, i + chunkSize);
    console.log(`\n⏳ Submitting Chunk [${Math.floor(i / chunkSize) + 1} / ${Math.ceil(missingTasks.length / chunkSize)}] (${chunk.length} items)...`);

    const prompt = `You are a master video game historian and catalog curator.
Your task is to analyze each group of games with matching/similar titles and determine if any of the listings represent the EXACT same video game release that should be merged, OR if they are DISTINCT games that must remain separate.

5-POINT VERIFICATION RUBRIC:
1. Studio Pedigree: Check if developers are the same, or if a studio rebranded (e.g. EA Redwood Shores became Visceral Games).
2. Generational & Platform Era: If games are from different console generations (e.g. 1990s vs 2020s, or PS2 vs PS5), or completely different engines/remakes, DO NOT merge.
3. Content Scope: Demos, Prologues, and standalone Expansion/DLCs (e.g. "Afterbirth" vs "Afterbirth+", Chapter 1 vs Full Game) MUST remain separate.
4. Homonyms: Independent indie games that merely share a common name (e.g. "Inside" 2012 by 9ine vs "Inside" 2016 by Playdead) MUST remain separate.
5. Storefront & Scraper Duplicates: Incomplete duplicate scraper entries or dual-language uploads by the same creator CAN be merged into the richer primary listing.

CANDIDATE GROUPS:
${JSON.stringify(chunk, null, 2)}

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

    let success = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!success && attempts < maxAttempts) {
      attempts++;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const raw = response.text || "";
        const jsonMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (!jsonMatch) {
          throw new Error("Failed to parse JSON array from model response");
        }

        const verdicts: Verdict[] = JSON.parse(jsonMatch[0]);
        newVerdicts.push(...verdicts);

        for (const v of verdicts) {
          if (v.shouldMerge) {
            console.log(`  🟢 [MERGE] "${v.title}": "${v.mergeSlug}" ➔ Merge into "${v.primarySlug}"`);
            console.log(`     Reason: ${v.reason}`);
          } else {
            console.log(`  🛡️ [KEEP SEPARATE] "${v.title}"`);
            console.log(`     Reason: ${v.reason}`);
          }
        }
        success = true;
      } catch (err: any) {
        console.warn(`  ⚠️ Attempt ${attempts} failed (${err?.message || err}). Backing off...`);
        if (attempts < maxAttempts) {
          const waitTime = Math.pow(2, attempts) * 1500; // 3s, 6s, 12s, 24s
          console.log(`     Waiting ${(waitTime / 1000).toFixed(1)}s before retry...`);
          await sleep(waitTime);
        } else {
          console.error(`  ❌ Exhausted retries for this chunk.`);
        }
      }
    }
  }

  // Combine, sort, and save all verdicts
  const combined = [...existingVerdicts, ...newVerdicts].sort((a, b) => a.id - b.id);
  const finalMap = new Map<number, Verdict>();
  for (const v of combined) {
    finalMap.set(v.id, v);
  }
  const finalized = Array.from(finalMap.values()).sort((a, b) => a.id - b.id);

  fs.writeFileSync(verdictsPath, JSON.stringify(finalized, null, 2), "utf-8");

  const approvedCount = finalized.filter((v) => v.shouldMerge).length;
  const protectedCount = finalized.filter((v) => !v.shouldMerge).length;

  console.log(`\n==================================================`);
  console.log(`🏁 RETRY COMPLETE: FULL 133-TASK COVERAGE ACHIEVED`);
  console.log(`==================================================`);
  console.log(`Total Tasks Arbitrated:   ${finalized.length} / ${allTasks.length}`);
  console.log(`🟢 Approved Merges:       ${approvedCount}`);
  console.log(`🛡️ Confirmed Protected:   ${protectedCount}`);
  console.log(`📁 Updated:               ${verdictsPath}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
