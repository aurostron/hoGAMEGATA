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

interface ArbVerdict {
  id: number;
  title: string;
  candidateSlug: string;
  shouldMerge: boolean;
  mergeIntoSlug: string | null;
  reason: string;
}

async function main() {
  console.log("\n==================================================");
  console.log("🤖 PHASE 3: GEMINI 2.5 FLASH BATCH ARBITRATION");
  console.log("==================================================");

  const apiKey = getCleanApiKey();
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing in .env!");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pipeline/data");
  const poolCPath = path.join(dataDir, "classified_pool_c.json");
  if (!fs.existsSync(poolCPath)) {
    console.error("❌ classified_pool_c.json not found!");
    process.exit(1);
  }

  const poolC = JSON.parse(fs.readFileSync(poolCPath, "utf-8"));
  const backupsDir = path.resolve(process.cwd(), "backups");
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("dedup_snapshot_") && f.endsWith(".json")).sort().reverse();
  const snapshot = JSON.parse(fs.readFileSync(path.join(backupsDir, files[0]), "utf-8"));

  // Map of normalized title -> all games
  const byTitle = new Map<string, any[]>();
  for (const g of snapshot.games) {
    const norm = g.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (!byTitle.has(norm)) byTitle.set(norm, []);
    byTitle.get(norm)!.push(g);
  }

  // Construct tasks
  const tasks: any[] = [];
  for (let i = 0; i < poolC.length; i++) {
    const item = poolC[i];
    const norm = item.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const allInTitle = byTitle.get(norm) || [];
    const candidate = item.games[0];
    const peers = allInTitle.filter(g => g.id !== candidate.id);

    const parseYear = (d: any) => {
      if (!d) return "Unknown";
      const ms = d < 1e11 ? d * 1000 : d;
      const y = new Date(ms).getFullYear();
      return (y >= 1970 && y <= 2035) ? y : "Unknown";
    };

    tasks.push({
      id: i + 1,
      title: item.title,
      candidate: {
        id: candidate.id,
        slug: candidate.slug,
        developer: candidate.developerNames || "Unknown",
        year: parseYear(candidate.releaseDate),
        platforms: candidate.platformNames || "Unknown",
        summary: (candidate.summary || "").slice(0, 150)
      },
      peers: peers.map(p => ({
        id: p.id,
        slug: p.slug,
        developer: p.developerNames || "Unknown",
        year: parseYear(p.releaseDate),
        platforms: p.platformNames || "Unknown",
        summary: (p.summary || "").slice(0, 150)
      }))
    });
  }

  console.log(`📋 Total tasks to arbitrate with Gemini 2.5 Flash: ${tasks.length}`);

  const batchSize = 20;
  const allVerdicts: ArbVerdict[] = [];

  for (let b = 0; b < tasks.length; b += batchSize) {
    const batch = tasks.slice(b, b + batchSize);
    console.log(`\n⏳ Dispatching Batch [${b / batchSize + 1} / ${Math.ceil(tasks.length / batchSize)}] (${batch.length} items) to Gemini 2.5 Flash...`);

    const prompt = `You are a video game database historian and catalog specialist.
Analyze each candidate game listing below against its peer listings of the same title.

Determine whether the candidate is a DUPLICATE of one of the peers (meaning it represents the exact same game release and should be merged into that peer), OR if it represents a SEPARATE distinct game (e.g. a different game with the same title, a remake, a port by a different developer team, or a different cancelled game).

RULES:
- "shouldMerge": true ONLY if candidate is the exact same game release as one of the peers.
- If "shouldMerge" is true, "mergeIntoSlug" must be the exact slug of the peer to merge into.
- If "shouldMerge" is false, "mergeIntoSlug" must be null.
- Provide a clear, concise 1-sentence historical explanation in "reason".

CANDIDATE LISTINGS:
${JSON.stringify(batch, null, 2)}

Respond with ONLY a valid JSON array of objects with the exact schema:
[
  {
    "id": 1,
    "title": "Game Title",
    "candidateSlug": "candidate-slug",
    "shouldMerge": false,
    "mergeIntoSlug": null,
    "reason": "Explanation why it is separate or duplicate"
  }
]`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      const rawText = response.text || "";
      const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) {
        console.error("❌ Failed to parse JSON array from Gemini response:");
        console.log(rawText);
        continue;
      }

      const verdicts: ArbVerdict[] = JSON.parse(jsonMatch[0]);
      allVerdicts.push(...verdicts);

      for (const v of verdicts) {
        if (v.shouldMerge) {
          console.log(`  🟢 [Merge] "${v.title}" (${v.candidateSlug}) ➔ Merge into "${v.mergeIntoSlug}"`);
          console.log(`     Reason: ${v.reason}`);
        } else {
          console.log(`  🛡️ [Keep Separate] "${v.title}" (${v.candidateSlug})`);
          console.log(`     Reason: ${v.reason}`);
        }
      }
    } catch (err) {
      console.error(`❌ Batch error:`, err);
    }
  }

  // Save verdicts
  const verdictsPath = path.join(dataDir, "gemini_verdicts.json");
  fs.writeFileSync(verdictsPath, JSON.stringify(allVerdicts, null, 2), "utf-8");

  const mergesCount = allVerdicts.filter(v => v.shouldMerge).length;
  const keepCount = allVerdicts.filter(v => !v.shouldMerge).length;

  console.log(`\n==================================================`);
  console.log(`🏁 GEMINI 2.5 FLASH ARBITRATION SUMMARY`);
  console.log(`==================================================`);
  console.log(`Total Cases Evaluated: ${allVerdicts.length} / ${tasks.length}`);
  console.log(`🟢 Approved Merges:    ${mergesCount}`);
  console.log(`🛡️ Kept Separate:      ${keepCount}`);
  console.log(`📁 Verdicts saved to:  ${verdictsPath}`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("❌ Fatal Arbiter Error:", err);
  process.exit(1);
});
