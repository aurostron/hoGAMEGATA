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

export const GAME_ABBREVIATIONS: Record<string, string> = {
  re: "Resident Evil",
  lou: "Last of Us",
  tlou: "The Last of Us",
  sh: "Silent Hill",
  tew: "The Evil Within",
  aw: "Alan Wake",
  dl: "Dying Light",
  l4d: "Left 4 Dead",
  fnaf: "Five Nights at Freddy's",
  dbd: "Dead by Daylight",
};

export function expandAbbreviations(query: string): string | null {
  if (!query) return null;
  const words = query.split(/\s+/);
  let expanded = false;
  const newWords = words.map(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (GAME_ABBREVIATIONS[cleanWord]) {
      expanded = true;
      const prefix = word.match(/^[^a-zA-Z0-9]*/)?.[0] || "";
      const suffix = word.match(/[^a-zA-Z0-9]*$/)?.[0] || "";
      return `${prefix}${GAME_ABBREVIATIONS[cleanWord]}${suffix}`;
    }
    return word;
  });
  return expanded ? newWords.join(" ") : null;
}

export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Deletion
        dp[i][j - 1] + 1,      // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return dp[m][n];
}

export function suggestCorrection(query: string, allTitles: string[]): string | null {
  if (!query || query.length < 3) return null;
  
  const cleanQuery = query.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  if (!cleanQuery) return null;

  let bestTitle: string | null = null;
  let minDistance = Infinity;
  let bestSimilarity = 0;

  for (const title of allTitles) {
    if (!title) continue;
    const cleanTitle = title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
    if (!cleanTitle) continue;

    // Exact match on alphanumeric representation
    if (cleanTitle === cleanQuery) {
      return title; // Found exact match
    }

    // Compute Levenshtein distance
    const dist = levenshteinDistance(cleanQuery, cleanTitle);
    
    // Calculate similarity index: 1 - (distance / maxLength)
    const maxLen = Math.max(cleanQuery.length, cleanTitle.length);
    const similarity = maxLen > 0 ? 1 - dist / maxLen : 0;

    // Check for substring match (e.g. "resident ev" in "resident evil") which has high weight
    const isSubstring = cleanTitle.includes(cleanQuery) || cleanQuery.includes(cleanTitle);

    if (similarity > bestSimilarity || (isSubstring && similarity + 0.12 > bestSimilarity)) {
      let score = similarity;
      if (isSubstring) score += 0.12; // Give boost to substring overlaps
      
      if (score > bestSimilarity) {
        bestSimilarity = score;
        minDistance = dist;
        bestTitle = title;
      }
    }
  }

  // Threshold: only suggest if similarity score is high enough (e.g. > 0.72)
  if (bestTitle && bestSimilarity >= 0.72) {
    // Avoid correcting if the distance is too large relative to query length
    if (minDistance <= Math.max(2, Math.floor(cleanQuery.length / 2))) {
      return bestTitle;
    }
  }

  return null;
}


