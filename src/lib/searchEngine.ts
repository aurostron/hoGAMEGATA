import { turso } from "./turso";
import { games as gamesTable, gamesToTags, tags as tagsTable, gameRecommendations as gameRecommendationsTable } from "../db/schema";
import { eq, and, or, inArray, notInArray, desc, asc, sql, isNull, ne, like } from "drizzle-orm";
import { TAXONOMY_GROUPS } from "./taxonomy";
import { enrichGamesWithRelations } from "./gameQueries";

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

export function normalizeQueryForCache(query: string): string {
  if (!query) return "";
  
  // 1. Lowercase
  let cleaned = query.toLowerCase().trim();
  
  // 2. Expand abbreviations
  const expandedAbbr = expandAbbreviations(cleaned);
  if (expandedAbbr) {
    cleaned = expandedAbbr.toLowerCase().trim();
  }
  
  // 3. Strip conversational filler phrases
  for (const regex of FILLER_PHRASES) {
    cleaned = cleaned.replace(regex, "");
  }
  
  // 4. Strip extra characters except alphanumeric, space, and dash
  cleaned = cleaned.replace(/[^a-z0-9\s\-]/g, " ");
  
  // 5. Split, sort, and join tokens to eliminate word order issues
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  tokens.sort();
  
  return tokens.join(" ");
}

export interface SearchDSL {
  suggested_titles?: string[];
  fallback_dsl?: {
    must_tags?: string[];
    prefer_tags?: string[];
    exclude_tags?: string[];
    reference_title?: string;
    filters?: {
      release_after?: string;
      min_rating?: number;
      platforms?: string[];
      status_exclude?: string[];
    };
    sort?: "relevance" | "rating" | "releaseDate";
  };
}

export function validateDSL(dsl: any): dsl is SearchDSL {
  if (typeof dsl !== "object" || dsl === null) return false;

  if (dsl.suggested_titles !== undefined) {
    if (!Array.isArray(dsl.suggested_titles)) return false;
    if (!dsl.suggested_titles.every((t: any) => typeof t === "string" && t.length < 200)) return false;
  }

  if (dsl.fallback_dsl !== undefined) {
    const f = dsl.fallback_dsl;
    if (typeof f !== "object" || f === null) return false;

    const VALID_SLUGS = new Set(
      TAXONOMY_GROUPS.flatMap(group => group.filters.map(f => f.slug))
    );

    const validateTagArray = (arr: any) => {
      if (arr === undefined) return true;
      if (!Array.isArray(arr)) return false;
      if (arr.length > 15) return false;
      return arr.every(item => typeof item === "string" && VALID_SLUGS.has(item));
    };

    if (!validateTagArray(f.must_tags)) return false;
    if (!validateTagArray(f.prefer_tags)) return false;
    if (!validateTagArray(f.exclude_tags)) return false;

    if (f.reference_title !== undefined && typeof f.reference_title !== "string") {
      return false;
    }

    if (f.filters !== undefined) {
      if (typeof f.filters !== "object" || f.filters === null) return false;
      
      if (f.filters.release_after !== undefined && typeof f.filters.release_after !== "string") {
        return false;
      }
      if (f.filters.min_rating !== undefined && typeof f.filters.min_rating !== "number") {
        return false;
      }
      if (f.filters.platforms !== undefined) {
        // Tweak: Tolerate single string platforms formatting from AI
        if (typeof f.filters.platforms === "string") {
          f.filters.platforms = [f.filters.platforms];
        }
        if (!Array.isArray(f.filters.platforms)) return false;
        if (!f.filters.platforms.every((p: any) => typeof p === "string" && p.length < 50)) return false;
      }
      if (f.filters.status_exclude !== undefined) {
        if (!Array.isArray(f.filters.status_exclude)) return false;
        if (!f.filters.status_exclude.every((s: any) => typeof s === "string" && s.length < 50)) return false;
      }
    }

    if (f.sort !== undefined && !["relevance", "rating", "releaseDate"].includes(f.sort)) {
      return false;
    }
  }

  return true;
}

import { gte } from "drizzle-orm";

export async function executeDSLQuery(dsl: SearchDSL) {
  const finalGames: any[] = [];
  const fetchedGameIds = new Set<string>();

  // Resolve reference title early to exclude it from suggestions / results
  let excludeTitle: string | null = null;
  let excludeGameId: string | null = null;

  if (dsl.fallback_dsl?.reference_title) {
    const refGameTitle = dsl.fallback_dsl.reference_title;
    const [refGame] = await turso
      .select({ id: gamesTable.id, title: gamesTable.title })
      .from(gamesTable)
      .where(or(
        like(gamesTable.title, refGameTitle),
        like(gamesTable.title, `%${refGameTitle}%`)
      ))
      .limit(1);
    if (refGame) {
      excludeTitle = refGame.title;
      excludeGameId = refGame.id;
    }
  }

  // 1. STAGE A: Direct suggested titles grounding (via targeted DB lookups instead of 18k title scan)
  if (dsl.suggested_titles && dsl.suggested_titles.length > 0) {
    const matchedGames: any[] = [];
    const matchedTitles: string[] = [];

    for (const title of dsl.suggested_titles) {
      if (excludeTitle && title.toLowerCase().includes(excludeTitle.toLowerCase())) {
        continue;
      }

      const [exact] = await turso
        .select()
        .from(gamesTable)
        .where(like(gamesTable.title, title))
        .limit(1);

      if (exact) {
        matchedGames.push(exact);
        matchedTitles.push(exact.title);
      } else {
        const [approx] = await turso
          .select()
          .from(gamesTable)
          .where(like(gamesTable.title, `%${title}%`))
          .limit(1);
        if (approx && approx.title !== excludeTitle) {
          matchedGames.push(approx);
          matchedTitles.push(approx.title);
        }
      }
    }

    if (matchedGames.length > 0) {
      // Resolve platform filters for direct titles filtering
      const platformConditions = [];
      if (dsl.fallback_dsl?.filters?.platforms && dsl.fallback_dsl.filters.platforms.length > 0) {
        for (const p of dsl.fallback_dsl.filters.platforms) {
          const lp = p.toLowerCase();
          if (lp === "android") {
            platformConditions.push(like(gamesTable.platformNames, "%android%"));
          } else if (lp === "linux") {
            platformConditions.push(like(gamesTable.platformNames, "%linux%"));
          } else if (lp === "mac" || lp === "macos" || lp === "osx") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%mac%"),
              like(gamesTable.platformNames, "%osx%"),
              like(gamesTable.platformNames, "%os-x%")
            ));
          } else if (lp === "pc" || lp === "windows" || lp === "win") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%windows%"),
              like(gamesTable.platformNames, "%win%"),
              like(gamesTable.platformNames, "%pc%")
            ));
          } else if (lp === "nintendo" || lp === "switch") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%switch%"),
              like(gamesTable.platformNames, "%nintendo%")
            ));
          } else if (lp === "playstation" || lp === "ps") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%playstation%"),
              like(gamesTable.platformNames, "%ps%")
            ));
          } else if (lp === "xbox") {
            platformConditions.push(like(gamesTable.platformNames, "%xbox%"));
          } else if (lp === "ios" || lp === "iphone" || lp === "ipad") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%ios%"),
              like(gamesTable.platformNames, "%iphone%"),
              like(gamesTable.platformNames, "%ipad%")
            ));
          } else {
            platformConditions.push(like(gamesTable.platformNames, `%${p}%`));
          }
        }
      }

      // Filter matched games by status (not hidden) and platforms
      const filteredGames = matchedGames.filter(game => {
        if (game.status === "hidden") return false;
        if (platformConditions.length > 0) {
          const lowerPlatform = game.platformNames?.toLowerCase() || "";
          return dsl.fallback_dsl!.filters!.platforms!.some(p => {
            const lp = p.toLowerCase();
            if (lp === "android") return lowerPlatform.includes("android");
            if (lp === "linux") return lowerPlatform.includes("linux");
            if (lp === "mac" || lp === "macos" || lp === "osx") {
              return lowerPlatform.includes("mac") || lowerPlatform.includes("osx") || lowerPlatform.includes("os-x");
            }
            if (lp === "pc" || lp === "windows" || lp === "win") {
              return lowerPlatform.includes("windows") || lowerPlatform.includes("win") || lowerPlatform.includes("pc");
            }
            if (lp === "nintendo" || lp === "switch") {
              return lowerPlatform.includes("switch") || lowerPlatform.includes("nintendo");
            }
            if (lp === "playstation" || lp === "ps") {
              return lowerPlatform.includes("playstation") || lowerPlatform.includes("ps");
            }
            if (lp === "xbox") return lowerPlatform.includes("xbox");
            if (lp === "ios" || lp === "iphone" || lp === "ipad") {
              return lowerPlatform.includes("ios") || lowerPlatform.includes("iphone") || lowerPlatform.includes("ipad");
            }
            return lowerPlatform.includes(lp);
          });
        }
        return true;
      });

      // Preserve AI's suggested order
      const titleToIndex = new Map(dsl.suggested_titles.map((t, idx) => [t.toLowerCase(), idx]));
      filteredGames.sort((a, b) => {
        const scoreA = titleToIndex.get(a.title.toLowerCase()) ?? titleToIndex.get(matchedTitles.find(t => a.title.toLowerCase().includes(t.toLowerCase()))?.toLowerCase() || "") ?? 99;
        const scoreB = titleToIndex.get(b.title.toLowerCase()) ?? titleToIndex.get(matchedTitles.find(t => b.title.toLowerCase().includes(t.toLowerCase()))?.toLowerCase() || "") ?? 99;
        return scoreA - scoreB;
      });

      for (const game of filteredGames) {
        if (!fetchedGameIds.has(game.id)) {
          finalGames.push(game);
          fetchedGameIds.add(game.id);
        }
      }
    }
  }

  // 2. STAGE B: Fallback DSL query (if we have slots remaining or no suggested titles)
  if (finalGames.length < 5 && dsl.fallback_dsl) {
    const fallback = dsl.fallback_dsl;
    const slotsNeeded = 5 - finalGames.length;

    let recommendedGameIds: string[] = [];
    const recDistanceMap = new Map<string, number>();

    // Resolve reference recommendations (already resolved excludeGameId/excludeTitle above)
    if (excludeGameId) {
      const recs = await turso
        .select({
          recommendedGameId: gameRecommendationsTable.recommendedGameId,
          distance: gameRecommendationsTable.distance,
        })
        .from(gameRecommendationsTable)
        .where(eq(gameRecommendationsTable.gameId, excludeGameId))
        .orderBy(gameRecommendationsTable.distance)
        .limit(100);
      
      for (const r of recs) {
        recommendedGameIds.push(r.recommendedGameId);
        recDistanceMap.set(r.recommendedGameId, r.distance);
      }
    }

    const conditions = [];
    conditions.push(or(isNull(gamesTable.status), ne(gamesTable.status, "hidden")));

    // Exclude the reference game ID itself from the candidates pool
    if (excludeGameId) {
      conditions.push(ne(gamesTable.id, excludeGameId));
    }
    if (fetchedGameIds.size > 0) {
      conditions.push(notInArray(gamesTable.id, Array.from(fetchedGameIds)));
    }

    // Exclude tag filters
    if (fallback.exclude_tags && fallback.exclude_tags.length > 0) {
      const excludeGameIdsResult = await turso
        .select({ gameId: gamesToTags.gameId })
        .from(gamesToTags)
        .innerJoin(tagsTable, eq(gamesToTags.tagId, tagsTable.id))
        .where(inArray(tagsTable.slug, fallback.exclude_tags));
      
      const excludeGameIds = excludeGameIdsResult.map(r => r.gameId);
      if (excludeGameIds.length > 0) {
        conditions.push(notInArray(gamesTable.id, excludeGameIds));
      }
    }

    // Direct filters
    if (fallback.filters) {
      if (fallback.filters.release_after) {
        const parsedDate = new Date(fallback.filters.release_after);
        if (!isNaN(parsedDate.getTime())) {
          conditions.push(gte(gamesTable.releaseDate, parsedDate));
        }
      }
      if (fallback.filters.min_rating !== undefined) {
        conditions.push(gte(gamesTable.rating, fallback.filters.min_rating));
      }
      if (fallback.filters.status_exclude && fallback.filters.status_exclude.length > 0) {
        conditions.push(notInArray(gamesTable.status, fallback.filters.status_exclude));
      }
      if (fallback.filters.platforms && fallback.filters.platforms.length > 0) {
        const platformConditions = [];
        for (const p of fallback.filters.platforms) {
          const lp = p.toLowerCase();
          if (lp === "android") {
            platformConditions.push(like(gamesTable.platformNames, "%android%"));
          } else if (lp === "linux") {
            platformConditions.push(like(gamesTable.platformNames, "%linux%"));
          } else if (lp === "mac" || lp === "macos" || lp === "osx") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%mac%"),
              like(gamesTable.platformNames, "%osx%"),
              like(gamesTable.platformNames, "%os-x%")
            ));
          } else if (lp === "pc" || lp === "windows" || lp === "win") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%windows%"),
              like(gamesTable.platformNames, "%win%"),
              like(gamesTable.platformNames, "%pc%")
            ));
          } else if (lp === "nintendo" || lp === "switch") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%switch%"),
              like(gamesTable.platformNames, "%nintendo%")
            ));
          } else if (lp === "playstation" || lp === "ps") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%playstation%"),
              like(gamesTable.platformNames, "%ps%")
            ));
          } else if (lp === "xbox") {
            platformConditions.push(like(gamesTable.platformNames, "%xbox%"));
          } else if (lp === "ios" || lp === "iphone" || lp === "ipad") {
            platformConditions.push(or(
              like(gamesTable.platformNames, "%ios%"),
              like(gamesTable.platformNames, "%iphone%"),
              like(gamesTable.platformNames, "%ipad%")
            ));
          } else {
            platformConditions.push(like(gamesTable.platformNames, `%${p}%`));
          }
        }
        if (platformConditions.length > 0) {
          conditions.push(or(...platformConditions));
        }
      }
    }

    // Query candidates
    let rawCandidates: any[] = [];
    const searchTags = [...(fallback.must_tags || []), ...(fallback.prefer_tags || [])];

    if (searchTags.length > 0) {
      let candidateIds: string[] = [];

      if (fallback.must_tags && fallback.must_tags.length > 0) {
        const mustGameIdsResult = await turso
          .select({ gameId: gamesToTags.gameId })
          .from(gamesToTags)
          .innerJoin(tagsTable, eq(gamesToTags.tagId, tagsTable.id))
          .where(inArray(tagsTable.slug, fallback.must_tags))
          .groupBy(gamesToTags.gameId)
          .having(sql`count(distinct ${gamesToTags.tagId}) = ${fallback.must_tags.length}`);

        const mustGameIds = mustGameIdsResult.map(r => r.gameId);
        if (mustGameIds.length > 0) {
          const matches = await turso
            .select({ gameId: gamesToTags.gameId })
            .from(gamesToTags)
            .innerJoin(tagsTable, eq(gamesToTags.tagId, tagsTable.id))
            .where(and(
              inArray(gamesToTags.gameId, mustGameIds),
              inArray(tagsTable.slug, searchTags)
            ))
            .groupBy(gamesToTags.gameId)
            .orderBy(desc(sql`count(${gamesToTags.tagId})`))
            .limit(80);

          candidateIds = matches.map(m => m.gameId);
          const matchedSet = new Set(candidateIds);
          for (const id of mustGameIds) {
            if (!matchedSet.has(id)) {
              candidateIds.push(id);
              if (candidateIds.length >= 80) break;
            }
          }
        }
      } else {
        const matches = await turso
          .select({ gameId: gamesToTags.gameId })
          .from(gamesToTags)
          .innerJoin(tagsTable, eq(gamesToTags.tagId, tagsTable.id))
          .where(inArray(tagsTable.slug, searchTags))
          .groupBy(gamesToTags.gameId)
          .orderBy(desc(sql`count(${gamesToTags.tagId})`))
          .limit(80);

        candidateIds = matches.map(m => m.gameId);
      }

      if (candidateIds.length > 0) {
        rawCandidates = await turso
          .select()
          .from(gamesTable)
          .where(and(
            inArray(gamesTable.id, candidateIds),
            ...conditions
          ));
        
        const idToIndexMap = new Map(candidateIds.map((id, index) => [id, index]));
        rawCandidates.sort((a, b) => (idToIndexMap.get(a.id) ?? 999) - (idToIndexMap.get(b.id) ?? 999));
      }
    } else {
      rawCandidates = await turso
        .select()
        .from(gamesTable)
        .where(and(...conditions))
        .orderBy(desc(gamesTable.popularity), desc(gamesTable.rating))
        .limit(80);
    }

    if (rawCandidates.length > 0) {
      // Score candidates to select best matches
      const candidateIdsList = rawCandidates.map(g => g.id);
      const tagMappingResult = await turso
        .select({
          gameId: gamesToTags.gameId,
          tagSlug: tagsTable.slug
        })
        .from(gamesToTags)
        .innerJoin(tagsTable, eq(gamesToTags.tagId, tagsTable.id))
        .where(inArray(gamesToTags.gameId, candidateIdsList));

      const gameTagsMap = new Map<string, string[]>();
      for (const row of tagMappingResult) {
        if (!gameTagsMap.has(row.gameId)) {
          gameTagsMap.set(row.gameId, []);
        }
        gameTagsMap.get(row.gameId)!.push(row.tagSlug);
      }

      const scoredCandidates = rawCandidates.map(game => {
        let score = 1.0;

        // Base rating is a minor tie-breaker only (max +1.0)
        if (game.rating) {
          score += (game.rating / 100.0);
        }
        if (game.popularity) {
          score += (game.popularity * 0.01);
        }

        // Large recommendation boost
        if (recDistanceMap.has(game.id)) {
          const distance = recDistanceMap.get(game.id)!;
          const similarity = Math.max(0, 1 - distance);
          score += (similarity * 15.0);
        }

        // Heavy preferred tag weight (+10.0 per match)
        const gameTagSlugs = gameTagsMap.get(game.id) || [];
        if (fallback.prefer_tags && fallback.prefer_tags.length > 0 && gameTagSlugs.length > 0) {
          for (const pt of fallback.prefer_tags) {
            if (gameTagSlugs.includes(pt)) {
              score += 10.0;
            }
          }
        }

        // Tag Bloat Penalty: divide boost by total tag count to penalize automated sponge matching
        if (gameTagSlugs.length > 10) {
          score = score * (10 / gameTagSlugs.length);
        }

        return { game, score };
      });

      // Sort
      if (fallback.sort === "rating") {
        scoredCandidates.sort((a, b) => (b.game.rating || 0) - (a.game.rating || 0));
      } else if (fallback.sort === "releaseDate") {
        scoredCandidates.sort((a, b) => {
          const dateA = a.game.releaseDate ? new Date(a.game.releaseDate).getTime() : 0;
          const dateB = b.game.releaseDate ? new Date(b.game.releaseDate).getTime() : 0;
          return dateB - dateA;
        });
      } else {
        scoredCandidates.sort((a, b) => b.score - a.score);
      }

      // Fill remaining slots
      const fillCandidates = scoredCandidates.slice(0, slotsNeeded).map(item => item.game);
      for (const game of fillCandidates) {
        if (!fetchedGameIds.has(game.id)) {
          finalGames.push(game);
          fetchedGameIds.add(game.id);
        }
      }
    }
  }

  // 3. Final Step: Enrich ONLY the final 5 grounding results
  const slicedResults = finalGames.slice(0, 5);
  if (slicedResults.length === 0) return [];
  
  return await enrichGamesWithRelations(slicedResults);
}
