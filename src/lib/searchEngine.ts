let extractorInstance: any = null;

// Caches queries to their generated number array vector embedding
const queryVectorCache = new Map<string, number[]>();

export async function getExtractor() {
  if (!extractorInstance) {
    // Dynamic import: @xenova/transformers is heavy (~141 MB source);
    // lazy-loading it prevents nft from tracing the entire dep tree into the bundle.
    const { pipeline } = await import("@xenova/transformers");
    extractorInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractorInstance;
}

// Custom horror vocabulary mappings to expand query semantics
const HORROR_VOCABULARY: Record<string, string> = {
  "backrooms": "liminal spaces, empty yellow rooms, fluorescent lights hum, endless hallways, creepypasta",
  "slasher": "masked killer, teenagers, cabin in the woods, hunting, blood, gore, murder",
  "soulslike": "punishing difficulty, dark fantasy, challenging combat, checkpoints, atmospheric, dodge roll",
  "pt clone": "looping hallway, photo-realistic, shifting rooms, psychological tension, jumpscares, domestic horror",
  "analog horror": "retro VHS tape, local television broadcasts, distorted footage, cryptic alerts, retro screens",
  "liminal": "uncanny empty familiar spaces, abandoned malls, fluorescent lighting, loneliness, quiet dread",
  "cosmic horror": "lovecraftian, ancient gods, madness, tentacles, incomprehensible scale, loss of sanity",
  "mascot horror": "creepy children toys, abandoned theme parks, friendly characters turned evil, puzzles",
  "boomer shooter": "retro 90s FPS, fast-paced shooting, keys, secrets, pixelated monsters, high action",
  "walking sim": "slow narrative exploration, atmospheric storytelling, no combat, interactive environments",
  "survival horror": "limited ammo, inventory management, puzzle solving, backtracking, vulnerable protagonist",
  "body horror": "grotesque physical transformations, mutations, disfigurement, organic decay, surgical horror",
  "found footage": "shaky hand-held camera, first-person recording, night vision, authentic documentation style",
};

// Conversational fillers to strip
const FILLER_PHRASES = [
  /\b(i want to play|show me|find me|look for|a game like|games like|similar to|something like)\b/gi,
  /\b(tell me about|do you have|are there any)\b/gi,
  /\b(please|thanks|gemini|claude)\b/gi
];

// Mapping of query tokens to database tag slugs
const CONSTRAINT_MAPPINGS: { pattern: RegExp; slug: string }[] = [
  { pattern: /\b(co-op|coop|cooperative)\b/i, slug: "co-op" },
  { pattern: /\b(multiplayer|multi-player)\b/i, slug: "multiplayer" },
  { pattern: /\b(first-person|first person|1st-person|1st person|fps)\b/i, slug: "first-person" },
  { pattern: /\b(third-person|third person|3rd-person|3rd person)\b/i, slug: "third-person" },
  { pattern: /\b(isometric)\b/i, slug: "isometric" },
  { pattern: /\b(side-view|side view|side scroller|side-scroller|sidescroller)\b/i, slug: "side-view" },
  { pattern: /\b(top-down|top down)\b/i, slug: "bird-view-top-down" },
  { pattern: /\b(vhs|analog setting)\b/i, slug: "vhs-analog" },
  { pattern: /\b(pixel art|pixel)\b/i, slug: "pixel-art" },
  { pattern: /\b(retro ps1|ps1|low poly|low-poly)\b/i, slug: "retro-ps1" }
];

export interface PreprocessedQuery {
  rawQuery: string;
  cleanedQuery: string;
  expandedQuery: string;
  extractedSlugs: string[];
}

export function preprocessSearchQuery(query: string): PreprocessedQuery {
  const rawQuery = query;
  let cleaned = query;

  // 1. Extract and strip structural tag constraints
  const extractedSlugs: string[] = [];
  for (const mapping of CONSTRAINT_MAPPINGS) {
    if (mapping.pattern.test(cleaned)) {
      extractedSlugs.push(mapping.slug);
      // Strip constraint words to avoid vector noise
      cleaned = cleaned.replace(mapping.pattern, "");
    }
  }

  // 2. Strip conversational filler phrases
  for (const regex of FILLER_PHRASES) {
    cleaned = cleaned.replace(regex, "");
  }

  // Clean double spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 3. Expand vocabulary semantic terms
  let expanded = cleaned;
  const words = cleaned.toLowerCase().split(/\s+/);
  for (const word of words) {
    const matchedTerm = Object.keys(HORROR_VOCABULARY).find(
      key => key === word || word.includes(key)
    );
    if (matchedTerm) {
      expanded += ` (${HORROR_VOCABULARY[matchedTerm]})`;
    }
  }

  return {
    rawQuery,
    cleanedQuery: cleaned,
    expandedQuery: expanded,
    extractedSlugs
  };
}

export async function embedQuery(text: string): Promise<number[]> {
  const cacheKey = text.toLowerCase().trim();
  if (queryVectorCache.has(cacheKey)) {
    return queryVectorCache.get(cacheKey)!;
  }

  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const vector = Array.from(output.data) as number[];
  
  queryVectorCache.set(cacheKey, vector);
  return vector;
}
