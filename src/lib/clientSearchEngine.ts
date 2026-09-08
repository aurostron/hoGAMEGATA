/**
 * Client-Side In-Memory & IndexedDB Search Engine
 * 
 * Provides instantaneous (<5ms) search across 107,000+ horror games.
 * Fetches the pre-compiled index once from jsDelivr / local fallback,
 * caches it permanently in browser IndexedDB, and runs scoring in memory.
 * 
 * Database Impact: STRICTLY 0 READS to TursoDB.
 */

export interface SearchRecord {
  i: string;           // id
  t: string;           // title
  s: string;           // slug
  c?: string | null;   // coverUrl
  d?: string[] | string | null; // developers
  dp?: number | null;  // cheapest price
  rt?: number | null;  // rating
}

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  developerNames: string | null;
  priceBadge?: string | null;
  badgeType?: "free" | "sale" | "paid";
}

import { loadCatalogFromDB, initCatalogWorker } from "./catalogStorage";

let memoryIndex: SearchRecord[] | null = null;
let isInitializing = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize search engine using unified catalog dump in IndexedDB
 */
export function initSearchEngine(): Promise<boolean> {
  if (memoryIndex !== null) return Promise.resolve(true);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    isInitializing = true;
    try {
      // 1. Load from unified Catalog Storage (GamegataCatalogDB_v1) first (0ms, 108k+ games)
      const catalogRecords = await loadCatalogFromDB();
      if (catalogRecords && catalogRecords.length > 0) {
        memoryIndex = catalogRecords.map((r: any) => ({
          i: r.i,
          t: r.t,
          s: r.s,
          c: r.c || null,
          d: r.dn || null,
          dp: r.dp ?? null,
          rt: r.rt ?? null,
        }));
        isInitializing = false;
        return true;
      }

      // 2. If not yet cached in IndexedDB, trigger the unified catalog worker sync (streams catalog-dump.json.gz)
      try {
        const ready = await initCatalogWorker();
        if (ready) {
          const fresh = await loadCatalogFromDB();
          if (fresh && fresh.length > 0) {
            memoryIndex = fresh.map((r: any) => ({
              i: r.i,
              t: r.t,
              s: r.s,
              c: r.c || null,
              d: r.dn || null,
              dp: r.dp ?? null,
              rt: r.rt ?? null,
            }));
            isInitializing = false;
            return true;
          }
        }
      } catch (workerErr) {
        console.warn("[ClientSearchEngine] Catalog worker sync failed:", workerErr);
      }

      isInitializing = false;
      return false;
    } catch (err) {
      console.warn("[ClientSearchEngine] Init failed:", err);
      isInitializing = false;
      return false;
    }
  })();

  return initPromise;
}

export function isSearchReady(): boolean {
  return memoryIndex !== null && memoryIndex.length > 0;
}

function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  if (Math.abs(al - bl) > 3) return 99;

  const d: number[][] = [];
  for (let i = 0; i <= al; i++) d[i] = [i];
  for (let j = 0; j <= bl; j++) d[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[al][bl];
}

/**
 * Fast in-memory search across all 107k games
 * Execution time: <5ms
 */
export function searchLocal(query: string, limit = 8): SearchResult[] {
  if (!memoryIndex || !query) return [];

  const cleanQuery = query.toLowerCase().trim();
  if (cleanQuery.length === 0) return [];

  const terms = cleanQuery.split(/\s+/).filter((t) => t.length > 0);
  const firstTerm = terms[0] || cleanQuery;

  interface ScoredItem {
    item: SearchRecord;
    score: number;
  }

  const matches: ScoredItem[] = [];

  for (let i = 0; i < memoryIndex.length; i++) {
    const game = memoryIndex[i];
    const titleLower = game.t.toLowerCase();

    let score = 0;

    if (titleLower === cleanQuery) {
      score = 1000;
    } else if (titleLower.startsWith(cleanQuery)) {
      score = 500;
    } else if (titleLower.includes(cleanQuery)) {
      score = 300;
    } else if (titleLower.startsWith(firstTerm)) {
      score = 200;
    } else {
      let allTermsMatch = true;
      for (let j = 0; j < terms.length; j++) {
        if (!titleLower.includes(terms[j])) {
          allTermsMatch = false;
          break;
        }
      }
      if (allTermsMatch && terms.length > 1) {
        score = 150;
      }
    }

    // Developer match boost if no strong title match
    if (score < 300 && game.d) {
      const devStr = Array.isArray(game.d) ? game.d.join(" ") : String(game.d);
      const devLower = devStr.toLowerCase();
      if (devLower.includes(cleanQuery)) {
        score = Math.max(score, 120);
      }
    }

    if (score > 0) {
      matches.push({ item: game, score });
    }
  }

  // Typo tolerance fallback if 0 exact matches found
  if (matches.length === 0 && cleanQuery.length >= 3) {
    let bestMatchTitle: string | null = null;
    let bestScore = -1;
    const qWords = cleanQuery.split(/[\s:,\-_]+/).filter(Boolean);

    for (let i = 0; i < memoryIndex.length; i++) {
      const game = memoryIndex[i];
      const tClean = game.t.toLowerCase().trim();

      if (Math.abs(tClean.length - cleanQuery.length) > 5) continue;

      const dist = damerauLevenshtein(cleanQuery, tClean);
      const maxAllowed = cleanQuery.length <= 4 ? 1 : (cleanQuery.length <= 8 ? 2 : 3);
      if (dist <= maxAllowed) {
        const score = 100 - dist * 20;
        if (score > bestScore) {
          bestScore = score;
          bestMatchTitle = tClean;
        }
        continue;
      }

      if (qWords.length > 1) {
        const tWords = tClean.split(/[\s:,\-_]+/).filter(Boolean);
        if (tWords.length >= qWords.length) {
          let matchedCount = 0;
          let totalDist = 0;
          for (let k = 0; k < qWords.length; k++) {
            const qw = qWords[k];
            const tw = tWords[k];
            if (!tw) break;
            if (qw === tw) {
              matchedCount++;
            } else {
              const d = damerauLevenshtein(qw, tw);
              if (d <= (qw.length <= 4 ? 1 : 2)) {
                matchedCount++;
                totalDist += d;
              }
            }
          }
          if (matchedCount === qWords.length) {
            const score = 90 - totalDist * 10;
            if (score > bestScore) {
              bestScore = score;
              bestMatchTitle = tClean;
            }
          }
        }
      }
    }

    if (bestMatchTitle && bestMatchTitle !== cleanQuery) {
      return searchLocal(bestMatchTitle, limit);
    }
  }

  // Sort descending by relevance score
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit).map((m) => {
    const devNames = m.item.d
      ? Array.isArray(m.item.d)
        ? m.item.d.join(", ")
        : String(m.item.d)
      : null;

    let priceBadge: string | null = null;
    let badgeType: "free" | "sale" | "paid" = "paid";
    if (m.item.dp !== undefined && m.item.dp !== null) {
      if (m.item.dp === 0) {
        priceBadge = "FREE";
        badgeType = "free";
      } else {
        priceBadge = `$${m.item.dp.toFixed(2)}`;
        badgeType = "paid";
      }
    }

    return {
      id: m.item.i,
      title: m.item.t,
      slug: m.item.s,
      coverUrl: m.item.c || null,
      developerNames: devNames,
      priceBadge,
      badgeType,
    };
  });
}
