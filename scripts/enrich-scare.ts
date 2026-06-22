import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Error: GEMINI_API_KEY is not set in your .env file.");
  process.exit(1);
}

let prisma: PrismaClient;
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 60000,
  max: 10,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
prisma = new PrismaClient({ adapter });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const freeLlm = new OpenAI({ 
  baseURL: "http://localhost:3001/v1", 
  apiKey: process.env.FREELLM_API_KEY || "dummy-key" 
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ScareProfile {
  dread: number;
  jumpscare: number;
  psychological: number;
  gore: number;
  tension: number;
  disturbing: number;
  isolation: number;
  shortSummary?: string;
  playerWarnings?: string[];
}

// -------------------------------------------------------------
// Scoring Logic
// -------------------------------------------------------------

async function fetchSteamReviews(steamAppId: string): Promise<any[]> {
  try {
    const url = `https://store.steampowered.com/appreviews/${steamAppId}?json=1&num_per_page=50&filter=all`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 hoGAMEGATA/1.0"
      }
    });
    if (response.ok) {
      const data = await response.json();
      return data.reviews || [];
    }
  } catch (error) {
    console.error(`⚠️ Failed to fetch Steam reviews for App ID ${steamAppId}:`, error);
  }
  return [];
}

function cleanAndExtractReviews(reviews: any[]): string {
  // Filter out joke reviews and very short reviews
  const cleaned = reviews.filter(r => {
    const text = (r.review || "").trim();
    const wordCount = text.split(/\s+/).length;
    return wordCount >= 10 && !text.includes("shat my pants 10/10");
  });

  // Take the top 30 valid reviews for maximum token efficiency
  const topReviews = cleaned.slice(0, 30);
  
  if (topReviews.length === 0) return "";

  // Minify: truncate to 400 chars, strip all linebreaks/excess whitespace, use dense delimiters
  return topReviews.map((r, i) => {
    let minified = r.review.replace(/\s+/g, ' ').trim();
    if (minified.length > 400) minified = minified.substring(0, 400) + '...';
    return `[${i+1}] ${minified}`;
  }).join(' ');
}

async function processSteamScare(reviews: any[]): Promise<{ rating: number, profile: ScareProfile, reviewCount: number } | null> {
  const digest = cleanAndExtractReviews(reviews);
  if (!digest) return null;

  const prompt = `You are an expert horror game analysis engine.
Analyze player sentiment and determine the game's scare profile based on these Steam reviews.

SCORING RUBRIC (0-100):
- 90-100: Legendary, traumatizing horror (e.g. Visage, Amnesia). Players report extreme fear, panic attacks, or having to quit.
- 75-89: Very scary. Consistently terrifying, high tension.
- 50-74: Moderately scary. Standard horror game, spooky but manageable.
- 0-49: Not very scary. Action-horror, mild spooks, or horror is secondary.

PARAMETERS TO SCORE:
- overallScare: The primary rating based on the rubric above.
- dread: Lingering anxiety, oppressive atmosphere, slow-burn tension.
- jumpscare: Cheap or earned sudden scares, loud noises, chaotic panic.
- psychological: Mind-bending, trauma, paranoia, insanity.
- gore: Blood, body horror, visceral mutilation.
- tension: High-stress chases, hiding mechanics, relentless pursuit.
- disturbing: Unsettling themes, taboo subjects, gross-out horror.
- isolation: Feeling completely alone, lost, or trapped without help.

Do NOT be afraid to use extreme scores (e.g. 95+ or 10-) if the reviews strongly support it.

Return ONLY valid JSON matching the following schema. Do NOT wrap it in markdown blockquotes like \`\`\`json.
{
  "overallScare": integer (0-100),
  "dread": integer (0-100),
  "jumpscare": integer (0-100),
  "psychological": integer (0-100),
  "gore": integer (0-100),
  "tension": integer (0-100),
  "disturbing": integer (0-100),
  "isolation": integer (0-100),
  "shortSummary": "1-2 sentences summarizing why it's scary.",
  "playerWarnings": ["warning 1", "warning 2", "warning 3"]
}

Review Digest:
${digest}`;

  let parsed: any = null;

  // 1. Try FreeLLM API Primary
  try {
    process.stdout.write(`  🤖 Primary: Hitting local FreeLLM API... `);
    const response = await freeLlm.chat.completions.create({
      model: "auto", // The Unified API requested 'auto' to auto-route
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const outputText = response.choices[0]?.message?.content;
    if (!outputText) throw new Error("Empty response");
    
    parsed = JSON.parse(outputText);
    console.log("✅ Success");
  } catch (err: any) {
    console.log(`❌ Failed (${err.message})`);
    console.log(`  ⚠️ Falling back to Gemini 2.5 Flash...`);
    
    // 2. Fallback to Gemini 2.5 Flash
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScare: { type: Type.INTEGER },
              dread: { type: Type.INTEGER },
              jumpscare: { type: Type.INTEGER },
              psychological: { type: Type.INTEGER },
              gore: { type: Type.INTEGER },
              tension: { type: Type.INTEGER },
              disturbing: { type: Type.INTEGER },
              isolation: { type: Type.INTEGER },
              shortSummary: { type: Type.STRING },
              playerWarnings: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["overallScare", "dread", "jumpscare", "psychological", "gore", "tension", "disturbing", "isolation", "shortSummary", "playerWarnings"]
          }
        }
      });

      const outputText = response.text;
      if (!outputText) throw new Error("Empty Gemini response");
      
      parsed = JSON.parse(outputText);
    } catch (fallbackErr: any) {
      console.error("  ❌ Gemini Fallback also failed:", fallbackErr.message);
      return null;
    }
  }

  if (!parsed) return null;

  const profile: ScareProfile = {
    dread: parsed.dread || 0,
    jumpscare: parsed.jumpscare || 0,
    psychological: parsed.psychological || 0,
    gore: parsed.gore || 0,
    tension: parsed.tension || 0,
    disturbing: parsed.disturbing || 0,
    isolation: parsed.isolation || 0,
    shortSummary: parsed.shortSummary,
    playerWarnings: parsed.playerWarnings || []
  };

  return {
    rating: parsed.overallScare || 0,
    profile,
    reviewCount: reviews.length
  };
}

function processTaxonomyScare(taxonomyScores: any): { rating: number, profile: ScareProfile } | null {
  if (!taxonomyScores || Object.keys(taxonomyScores).length === 0) return null;

  const profile: ScareProfile = {
    dread: 0, jumpscare: 0, psychological: 0, gore: 0, tension: 0, disturbing: 0, isolation: 0
  };

  let totalScoreSum = 0;
  let tagCount = 0;

  const addScore = (key: keyof ScareProfile, score: number) => {
    (profile as any)[key] = Math.max((profile as any)[key], score * 100);
    totalScoreSum += score;
    tagCount++;
  };

  if (taxonomyScores["oppressive"]) addScore("dread", taxonomyScores["oppressive"]);
  if (taxonomyScores["slow-burn"]) addScore("dread", taxonomyScores["slow-burn"]);
  if (taxonomyScores["isolated"]) { addScore("dread", taxonomyScores["isolated"] * 0.5); addScore("isolation", taxonomyScores["isolated"]); }
  
  if (taxonomyScores["jumpscare-heavy"]) addScore("jumpscare", taxonomyScores["jumpscare-heavy"]);
  if (taxonomyScores["chaotic-panic"]) { addScore("jumpscare", taxonomyScores["chaotic-panic"] * 0.5); addScore("tension", taxonomyScores["chaotic-panic"]); }
  
  if (taxonomyScores["psychological"]) addScore("psychological", taxonomyScores["psychological"]);
  
  if (taxonomyScores["body-horror"]) addScore("gore", taxonomyScores["body-horror"]);
  if (taxonomyScores["slasher"]) addScore("gore", taxonomyScores["slasher"] * 0.5);

  if (taxonomyScores["high-tension"]) { addScore("dread", taxonomyScores["high-tension"] * 0.5); addScore("tension", taxonomyScores["high-tension"]); }
  if (taxonomyScores["unsettling"]) { addScore("disturbing", taxonomyScores["unsettling"]); addScore("psychological", taxonomyScores["unsettling"] * 0.5); }

  if (tagCount === 0) return null;

  const averageScore = totalScoreSum / tagCount;
  const rating = Math.min(100, Math.round(averageScore * 100 * 1.5)); // boost slightly

  return { rating, profile };
}

// -------------------------------------------------------------
// Runner
// -------------------------------------------------------------

async function runScareEnrichment() {
  const args = process.argv.slice(2);
  let batchLimit = 50;
  let targetSlug: string | null = null;
  let targetTag: string | null = null;

  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      batchLimit = parsedLimit;
    }
  }

  const slugIndex = args.indexOf("--slug");
  if (slugIndex !== -1 && args[slugIndex + 1]) {
    targetSlug = args[slugIndex + 1];
  }

  const tagIndex = args.indexOf("--tag");
  if (tagIndex !== -1 && args[tagIndex + 1]) {
    targetTag = args[tagIndex + 1];
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let whereClause: any = {
    OR: [
      { scareRating: null },
      { lastScareSync: { lt: thirtyDaysAgo } }
    ]
  };

  if (targetTag) {
    whereClause.tags = { some: { slug: targetTag } };
  }

  console.log(`🤖 Loading FreeLLM API (with Gemini Fallback) for Scare Analysis...`);

  if (targetSlug) {
    whereClause = { slug: targetSlug };
    batchLimit = 1;
    console.log(`🎃 Querying database for specific game: ${targetSlug}...`);
  } else if (targetTag) {
    console.log(`🎃 Querying database for up to ${batchLimit} games with tag: ${targetTag}...`);
  } else {
    console.log(`🎃 Querying database for up to ${batchLimit} games needing Scare Meter enrichment...`);
  }
  
  const gamesToProcess = await prisma.game.findMany({
    where: whereClause,
    include: {
      purchaseLinks: true
    },
    take: batchLimit,
    orderBy: { popularity: 'desc' }
  });

  const count = gamesToProcess.length;
  if (count === 0) {
    console.log("🎉 All games have up-to-date scare ratings!");
    return;
  }

  console.log(`👻 Found ${count} games. Processing in batches...`);

  let enrichedCount = 0;

  for (let i = 0; i < count; i++) {
    const game = gamesToProcess[i];
    console.log(`\n📦 Processing ${i + 1} of ${count}: ${game.title}`);
    
    let steamSignal: ReturnType<typeof processSteamScare> extends Promise<infer T> ? T : never = null;
    let taxonomySignal: ReturnType<typeof processTaxonomyScare> = null;

    // 1. Get Steam Signal
    const steamLink = game.purchaseLinks?.find((link: any) => 
      link.storeName.toLowerCase() === "steam" || link.url.includes("steampowered.com")
    );
    const steamAppIdMatch = steamLink?.url.match(/\/app\/(\d+)/);
    const steamAppId = steamAppIdMatch ? steamAppIdMatch[1] : null;

    let madeApiCall = false;

    if (steamAppId) {
      const reviews = await fetchSteamReviews(steamAppId);
      if (reviews.length > 0) {
        steamSignal = await processSteamScare(reviews);
        madeApiCall = true;
      }
    }

    // 2. Get Taxonomy Signal
    if (game.taxonomyScores) {
      taxonomySignal = processTaxonomyScare(game.taxonomyScores);
    }

    // 3. Blend Signals
    let finalRating: number | null = null;
    let finalProfile: ScareProfile | null = null;
    let reviewCount: number | null = null;

    if (steamSignal && taxonomySignal) {
      finalRating = Math.round((steamSignal.rating * 0.7) + (taxonomySignal.rating * 0.3));
      reviewCount = steamSignal.reviewCount;
      finalProfile = { dread: 0, jumpscare: 0, psychological: 0, gore: 0, tension: 0, disturbing: 0, isolation: 0 };
      const keys: (keyof ScareProfile)[] = ["dread", "jumpscare", "psychological", "gore", "tension", "disturbing", "isolation"];
      keys.forEach(k => {
        (finalProfile as any)[k] = Math.round(((steamSignal!.profile as any)[k] * 0.7) + ((taxonomySignal!.profile as any)[k] * 0.3));
      });
      finalProfile.shortSummary = steamSignal.profile.shortSummary;
      finalProfile.playerWarnings = steamSignal.profile.playerWarnings;
    } else if (steamSignal) {
      finalRating = steamSignal.rating;
      finalProfile = steamSignal.profile;
      reviewCount = steamSignal.reviewCount;
    } else if (taxonomySignal) {
      finalRating = taxonomySignal.rating;
      finalProfile = taxonomySignal.profile;
    }

    // 4. Save to DB
    await prisma.game.update({
      where: { id: game.id },
      data: {
        scareRating: finalRating,
        scareProfile: finalProfile as any,
        scareReviewCount: reviewCount,
        lastScareSync: new Date()
      }
    });
    
    console.log(`  ✅ Cached scare rating for: ${game.title} (Score: ${finalRating !== null ? finalRating : 'N/A'})`);
    enrichedCount++;

    // Respect Gemini 15 RPM Free Tier limit (1 request per 4 seconds)
    if (madeApiCall && i < count - 1) {
      console.log(`  ⏳ Sleeping 4s to respect Gemini API limits...`);
      await sleep(4000);
    }
  }

  console.log(`\n🎉 Background scare enrichment complete! Processed ${enrichedCount} of ${count} games.`);
}

runScareEnrichment()
  .then(() => {
    prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Process crashed:", err);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
