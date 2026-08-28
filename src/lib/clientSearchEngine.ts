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
}

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  developerNames: string | null;
}

const DB_NAME = "gamegata_search_v3";
const STORE_NAME = "catalog_store";
const CACHE_KEY = "search_catalog_with_covers";
const INDEX_VERSION = "2026.09.04.v5_covers";

const LOCAL_PRIMARY_URL = "/search-index.json";
const CDN_URL = "https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public/search-index.json";

let memoryIndex: SearchRecord[] | null = null;
let isInitializing = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Open IndexedDB safely
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB not supported"));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load cached index from IndexedDB
 */
async function loadFromIndexedDB(): Promise<SearchRecord[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        const val = req.result;
        // Strict check: must have correct version and must have valid IDs and covers
        if (
          val &&
          val.version === INDEX_VERSION &&
          Array.isArray(val.data) &&
          val.data.length > 0 &&
          val.data[0]?.i
        ) {
          resolve(val.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Save index to IndexedDB for future visits
 */
async function saveToIndexedDB(data: SearchRecord[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ version: INDEX_VERSION, data }, CACHE_KEY);
  } catch {
    // Ignore storage errors (quota/private mode)
  }
}

/**
 * Initialize search engine in background
 */
export function initSearchEngine(): Promise<boolean> {
  if (memoryIndex !== null) return Promise.resolve(true);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    isInitializing = true;
    try {
      // 1. Try local IndexedDB first (0ms, offline)
      const cached = await loadFromIndexedDB();
      if (cached && cached.length > 0) {
        memoryIndex = cached;
        isInitializing = false;
        return true;
      }

      // 2. Fetch index: prefer local static asset first (which contains cover URLs and IDs)
      let data: SearchRecord[] | null = null;
      try {
        const localRes = await fetch(LOCAL_PRIMARY_URL);
        if (localRes.ok) {
          const json = await localRes.json();
          if (Array.isArray(json) && json.length > 0 && json[0]?.i) {
            data = json;
          }
        }
      } catch {
        // Fallback to CDN
      }

      if (!data) {
        try {
          const cdnRes = await fetch(CDN_URL, { cache: "force-cache" });
          if (cdnRes.ok) {
            const json = await cdnRes.json();
            if (Array.isArray(json) && json.length > 0 && json[0]?.i) {
              data = json;
            }
          }
        } catch {
          // CDN error
        }
      }

      if (data && data.length > 0) {
        memoryIndex = data;
        // Asynchronously save to IndexedDB without blocking UI
        saveToIndexedDB(data).catch(() => {});
        isInitializing = false;
        return true;
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

  // Sort descending by relevance score
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit).map((m) => {
    const devNames = m.item.d
      ? Array.isArray(m.item.d)
        ? m.item.d.join(", ")
        : String(m.item.d)
      : null;

    return {
      id: m.item.i,
      title: m.item.t,
      slug: m.item.s,
      coverUrl: m.item.c || null,
      developerNames: devNames,
    };
  });
}
