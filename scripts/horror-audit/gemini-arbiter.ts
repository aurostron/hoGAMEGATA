import "../load-env";
import * as fs from "fs";
import * as path from "path";

interface ArbResult {
  id: string;
  title: string;
  isHorror: boolean;
  classification: "pure-horror" | "horror-adjacent" | "non-horror";
  reason: string;
}

const ROUTER_URL = "http://127.0.0.1:3001/v1/chat/completions";
const ROUTER_TOKEN = "freellmapi-763409939c8e69b02b83ace5547a3090f7b8e96dc990f424";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n==================================================");
  console.log("🤖 PASS 1: HORROR ARBITRATION VIA FREELLMAPI ROUTER");
  console.log("==================================================");

  const dataDir = path.resolve(process.cwd(), "scripts/horror-audit/data");
  const candidatesPath = path.join(dataDir, "arb_candidates.json");
  const outPath = path.join(dataDir, "gemini_arbiter_results.json");

  if (!fs.existsSync(candidatesPath)) {
    console.error("❌ arb_candidates.json missing! Run prepare-arb-pool.ts first.");
    process.exit(1);
  }

  const allCandidates: any[] = JSON.parse(fs.readFileSync(candidatesPath, "utf-8"));
  console.log(`📋 Total Candidates in Pool: ${allCandidates.length}`);

  let existingResults: ArbResult[] = [];
  if (fs.existsSync(outPath)) {
    existingResults = JSON.parse(fs.readFileSync(outPath, "utf-8"));
  }

  const processedIds = new Set(existingResults.map((r) => r.id));
  const remainingCandidates = allCandidates.filter((c) => !processedIds.has(c.id));
  console.log(`📦 Previously Processed:     ${existingResults.length}`);
  console.log(`🔍 Remaining to Arbitrate:    ${remainingCandidates.length}`);

  if (remainingCandidates.length === 0) {
    console.log("✅ All candidates already arbitrated!");
    return;
  }

  const BATCH_SIZE = 20;
  const allResults: ArbResult[] = [...existingResults];
  const startTime = Date.now();

  for (let i = 0; i < remainingCandidates.length; i += BATCH_SIZE) {
    const batch = remainingCandidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remainingCandidates.length / BATCH_SIZE);

    console.log(`\n⏳ Submitting Batch [${batchNum} / ${totalBatches}] (${batch.length} items)...`);

    const formattedBatch = batch.map((b) => ({
      id: b.id,
      title: b.title,
      developer: b.developerNames || "Unknown",
      year: b.releaseDate ? new Date(b.releaseDate * 1000).getFullYear() : "Unknown",
      genres: b.genres.join(", ") || "None",
      tags: b.tags.slice(0, 10).join(", ") || "None",
      summary: b.summary ? b.summary.slice(0, 250) : "No description provided",
    }));

    const prompt = `You are a master video game archivist, game historian, and horror media scholar.
We are curating GAMEGATA, the world's premier horror game encyclopedia.
Our core philosophy: "Every game that prominently displays or uses horror and its thousands of sub-feelings (fear, dread, psychological tension, macabre mystery, eerie atmosphere, grotesque body horror, cosmic insignificance, grimdark despair) belongs in the catalog."

TASK:
Analyze each game below and determine if it belongs in the horror encyclopedia or if it is purely non-horror / non-game noise.

RULES:
1. INCLUSIVE AFFECTIVE DEFINITION: 
   - Games with sinister twists, psychological mind-games, dark visual novels (e.g. Cooking Companions, Doki Doki Literature Club), grimdark fantasy (e.g. Fear & Hunger), Lovecraftian themes, or dark apocalyptic vehicular combat (e.g. Twisted Metal) COUNT as horror.
2. INCIDENTAL IS NOT ENOUGH:
   - A bright, cheerful racing game, standard football/sports game, or a simple math tool that merely got tagged with a horror tag by mistake or as a joke is NOT horror.
3. NON-GAME UTILITIES & JOKES:
   - Calculators, test scripts, wallpaper packs, and non-games MUST be classified as non-horror.

CANDIDATES:
${JSON.stringify(formattedBatch, null, 2)}

Respond with ONLY a valid JSON array of objects with the exact schema:
[
  {
    "id": "game-id",
    "title": "Title",
    "isHorror": true or false,
    "classification": "pure-horror" or "horror-adjacent" or "non-horror",
    "reason": "1-sentence historical/thematic explanation"
  }
]`;

    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch(ROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ROUTER_TOKEN}`,
          },
          body: JSON.stringify({
            model: "auto",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (!jsonMatch) throw new Error("Failed to extract JSON array from router response");

        const verdicts: ArbResult[] = JSON.parse(jsonMatch[0]);
        allResults.push(...verdicts);

        for (const v of verdicts) {
          if (v.isHorror) {
            console.log(`  🟢 [KEEP: ${v.classification.toUpperCase()}] "${v.title}"`);
            console.log(`     Reason: ${v.reason}`);
          } else {
            console.log(`  🗑️ [REMOVE: NON-HORROR] "${v.title}"`);
            console.log(`     Reason: ${v.reason}`);
          }
        }

        // Save progress after each batch
        fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), "utf-8");
        success = true;

        // Brief 1-second pause
        await sleep(1000);
      } catch (err: any) {
        console.warn(`  ⚠️ Batch attempt ${attempts} failed (${err?.message || err}). Retrying...`);
        await sleep(3000);
      }
    }
  }

  const horrorCount = allResults.filter((r) => r.isHorror).length;
  const nonHorrorCount = allResults.filter((r) => !r.isHorror).length;

  console.log(`\n==================================================`);
  console.log(`🏁 FREELLMAPI HORROR ARBITRATION SUMMARY`);
  console.log(`==================================================`);
  console.log(`Total Evaluated:         ${allResults.length} / ${allCandidates.length}`);
  console.log(`🟢 Confirmed Horror:     ${horrorCount}`);
  console.log(`🗑️ Confirmed Non-Horror:   ${nonHorrorCount}`);
  console.log(`⏱️ Total Time:           ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`📁 Saved to:             ${outPath}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
