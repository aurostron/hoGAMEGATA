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

// Models to try in order of speed from our benchmark
const FAST_MODELS = ["gemini-2.5-flash", "groq/compound", "deepseek-v4-flash-free", "auto"];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: any, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function main() {
  console.log("\n==================================================");
  console.log("⚡ HIGH-SPEED PASS 1 ARBITER (10 ITEMS / BATCH)");
  console.log("==================================================");

  const dataDir = path.resolve(process.cwd(), "scripts/horror-audit/data");
  const candidatesPath = path.join(dataDir, "arb_candidates.json");
  const outPath = path.join(dataDir, "gemini_arbiter_results.json");

  const allCandidates: any[] = JSON.parse(fs.readFileSync(candidatesPath, "utf-8"));
  let existingResults: ArbResult[] = [];
  if (fs.existsSync(outPath)) {
    existingResults = JSON.parse(fs.readFileSync(outPath, "utf-8"));
  }

  const processedIds = new Set(existingResults.map((r) => r.id));
  const remainingCandidates = allCandidates.filter((c) => !processedIds.has(c.id));

  console.log(`📋 Total in Pool:            ${allCandidates.length}`);
  console.log(`📦 Previously Evaluated:     ${existingResults.length}`);
  console.log(`🔍 Remaining to Arbitrate:    ${remainingCandidates.length}`);

  if (remainingCandidates.length === 0) {
    console.log("✅ All candidates already evaluated!");
    return;
  }

  const BATCH_SIZE = 10; // Exactly 10 items per batch for optimal speed & reliability
  const allResults: ArbResult[] = [...existingResults];
  const startTime = Date.now();

  for (let i = 0; i < remainingCandidates.length; i += BATCH_SIZE) {
    const batch = remainingCandidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remainingCandidates.length / BATCH_SIZE);

    const formattedBatch = batch.map((b) => ({
      id: b.id,
      title: b.title,
      developer: b.developerNames || "Unknown",
      year: b.releaseDate ? new Date(b.releaseDate * 1000).getFullYear() : "Unknown",
      genres: b.genres.join(", ") || "None",
      tags: b.tags.slice(0, 8).join(", ") || "None",
      summary: b.summary ? b.summary.slice(0, 200) : "No description provided",
    }));

    const prompt = `You are a master video game archivist.
We are curating GAMEGATA, the world's premier horror game encyclopedia.
Philosophy: "Every game that prominently displays or uses horror and its thousands of sub-feelings (fear, dread, psychological tension, macabre mystery, eerie atmosphere, grotesque body horror, cosmic insignificance, grimdark despair) belongs in the catalog."

RULES:
1. INCLUSIVE AFFECTIVE SCOPE: Psychological horror, dark visual novels with sinister twists, grimdark fantasy (e.g. Fear & Hunger), and dark apocalyptic vehicular combat (e.g. Twisted Metal) COUNT as horror.
2. INCIDENTAL IS NOT ENOUGH: A cheerful game with one isolated Halloween level or a pure sports game is NOT a horror game.
3. UTILITIES & NOISE: Calculators, engine tests, asset packs, and joke memes MUST be classified as non-horror.

CANDIDATES:
${JSON.stringify(formattedBatch, null, 2)}

Respond with ONLY a valid JSON array:
[
  {
    "id": "...",
    "title": "...",
    "isHorror": true,
    "classification": "pure-horror" | "horror-adjacent" | "non-horror",
    "reason": "1-sentence reason"
  }
]`;

    let success = false;
    let modelIdx = 0;

    while (!success && modelIdx < FAST_MODELS.length) {
      const currentModel = FAST_MODELS[modelIdx];
      try {
        const t0 = Date.now();
        const response = await fetchWithTimeout(
          ROUTER_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ROUTER_TOKEN}`,
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [{ role: "user", content: prompt }],
            }),
          },
          15000 // 15s timeout
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (!jsonMatch) throw new Error("Failed to extract JSON array from response");

        const verdicts: ArbResult[] = JSON.parse(jsonMatch[0]);
        allResults.push(...verdicts);

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        process.stdout.write(
          `\r⚡ [${batchNum}/${totalBatches}] Done in ${elapsed}s via ${currentModel} (Total done: ${allResults.length}/${allCandidates.length})`
        );

        // Save immediately after each batch
        fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), "utf-8");
        success = true;
      } catch (err: any) {
        modelIdx++;
        console.warn(`\n  ⚠️ Model ${currentModel} failed (${err.message}). Trying ${FAST_MODELS[modelIdx] || 'none'}...`);
        await sleep(1000);
      }
    }

    if (!success) {
      console.error(`\n❌ Batch ${batchNum} failed all models. Skipping.`);
    }

    // Gentle 300ms pause
    await sleep(300);
  }

  const horrorCount = allResults.filter((r) => r.isHorror).length;
  const nonHorrorCount = allResults.filter((r) => !r.isHorror).length;

  console.log(`\n\n==================================================`);
  console.log(`🏁 ARBITRATION FINISHED`);
  console.log(`==================================================`);
  console.log(`Total Candidates Evaluated: ${allResults.length} / ${allCandidates.length}`);
  console.log(`🟢 Confirmed Horror:       ${horrorCount}`);
  console.log(`🗑️ Confirmed Non-Horror:     ${nonHorrorCount}`);
  console.log(`⏱️ Total Duration:         ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`📁 Saved to:               ${outPath}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
