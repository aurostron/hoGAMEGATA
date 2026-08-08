/**
 * Native Client Search Manager
 * 
 * Manages background downloading, IndexedDB caching, Web Worker execution,
 * and main-thread fallback for 0ms latency, typo-tolerant native search
 * suggestions across ALL devices (Desktop, Mobile, Tablet).
 */

import MiniSearch from "minisearch";

export interface NativeSearchResult {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  developerNames: string | null;
  score: number;
}

export interface SearchIndexRecord {
  i: string;           // id
  t: string;           // title
  s: string;           // slug
  c: string | null;    // coverUrl
  d: string[];         // developers
}

const IDB_NAME = "GamegataSearchDB";
const IDB_STORE = "catalog_index";
const IDB_VERSION = 1;
const PREF_KEY = "gamegata_native_search_enabled";

let workerInstance: Worker | null = null;
let mainThreadMiniSearch: MiniSearch<SearchIndexRecord> | null = null;
let mainThreadRecordsMap = new Map<string, SearchIndexRecord>();
let isEngineReady = false;
let messageIdCounter = 0;
let initPromise: Promise<boolean> | null = null;
const pendingCallbacks = new Map<number, (data: any) => void>();

// Device preference helper — enabled for ALL devices by default
export function isNativeSearchEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const preference = localStorage.getItem(PREF_KEY);
  if (preference !== null) {
    return preference === "true";
  }
  return true; // Compulsory on all devices by default
}

export function setNativeSearchPreference(enabled: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PREF_KEY, enabled ? "true" : "false");
  }
}

// Backward compatibility helpers
export function isDesktopDevice(): boolean {
  return isNativeSearchEnabled();
}
export function getNativeSearchPreference(): boolean {
  return isNativeSearchEnabled();
}

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedRecords(): Promise<{ records: SearchIndexRecord[]; timestamp: number } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get("latest");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveCachedRecords(records: SearchIndexRecord[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.put({ records, timestamp: Date.now() }, "latest");
  } catch (e) {
    console.warn("Failed to cache search index in IndexedDB:", e);
  }
}

// Initialize search engine (Worker first, Main thread fallback)
export async function initNativeSearch(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isNativeSearchEnabled()) return false;
  if (isEngineReady) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Try loading from IndexedDB first for instant startup
      const cached = await getCachedRecords();
      if (cached && cached.records && Array.isArray(cached.records) && cached.records.length > 0) {
        await loadRecordsIntoEngine(cached.records);
        isEngineReady = true;

        // Background revalidate if cache is older than 24 hours
        if (Date.now() - cached.timestamp > 86400000) {
          fetchFreshIndex();
        }
        return true;
      }

      // 2. Otherwise fetch fresh search-index.json
      return await fetchFreshIndex();
    } catch (e) {
      console.warn("Failed to initialize native search engine:", e);
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

async function loadRecordsIntoEngine(records: SearchIndexRecord[]): Promise<void> {
  // Try Web Worker initialization first
  try {
    if (!workerInstance && typeof Worker !== "undefined") {
      workerInstance = new Worker(
        new URL("../workers/searchWorker.ts", import.meta.url),
        { type: "module" }
      );

      workerInstance.onmessage = (event) => {
        const { id, type, error, results } = event.data;
        const callback = pendingCallbacks.get(id);
        if (callback) {
          pendingCallbacks.delete(id);
          if (type && type.endsWith("_ERROR")) {
            callback({ error });
          } else {
            callback(results || event.data);
          }
        }
      };
    }

    if (workerInstance) {
      const res = await sendWorkerMessage("INIT_INDEX", records);
      if (res && res.type === "INIT_SUCCESS") {
        return; // Worker loaded successfully
      }
    }
  } catch (err) {
    console.warn("Web Worker setup failed, falling back to main-thread MiniSearch:", err);
    workerInstance = null;
  }

  // Main-Thread Fallback if Worker is unavailable or fails
  const ms = new MiniSearch<SearchIndexRecord>({
    idField: "i",
    fields: ["t", "d"],
    storeFields: ["i", "t", "s", "c", "d"],
    extractField: (document, fieldName) => {
      if (fieldName === "d") {
        return (document[fieldName] as string[])?.join(" ") || "";
      }
      return (document as any)[fieldName];
    },
    searchOptions: {
      fuzzy: 0.2,
      prefix: true,
      boost: { t: 10, d: 3 },
      combineWith: "AND",
    },
  });

  mainThreadRecordsMap.clear();
  records.forEach((r) => mainThreadRecordsMap.set(String(r.i), r));
  ms.addAll(records);
  mainThreadMiniSearch = ms;
}

async function fetchFreshIndex(): Promise<boolean> {
  try {
    const res = await fetch("/search-index.json", { cache: "default" });
    if (!res.ok) return false;
    const records: SearchIndexRecord[] = await res.json();
    if (Array.isArray(records) && records.length > 0) {
      await saveCachedRecords(records);
      await loadRecordsIntoEngine(records);
      isEngineReady = true;
      return true;
    }
  } catch (e) {
    console.warn("Failed to fetch fresh search index:", e);
  }
  return false;
}

function sendWorkerMessage(type: string, payload: any): Promise<any> {
  return new Promise((resolve) => {
    if (!workerInstance) {
      resolve(null);
      return;
    }
    const id = ++messageIdCounter;
    pendingCallbacks.set(id, resolve);
    workerInstance.postMessage({ id, type, payload });
  });
}

// Public Native Search Suggestion Function
export async function searchNative(query: string, limit = 20): Promise<NativeSearchResult[] | null> {
  if (!isNativeSearchEnabled()) return null;
  if (!query || !query.trim()) return [];

  if (!isEngineReady) {
    const ok = await initNativeSearch();
    if (!ok || !isEngineReady) return null;
  }

  // 1. Try Web Worker execution first
  if (workerInstance) {
    try {
      const response = await sendWorkerMessage("SEARCH", { query, limit });
      if (response && Array.isArray(response.results)) {
        return response.results;
      }
    } catch (e) {
      console.warn("Worker search failed, falling back to main thread:", e);
    }
  }

  // 2. Main thread search fallback
  if (mainThreadMiniSearch) {
    try {
      const searchResults = mainThreadMiniSearch.search(query.trim(), {
        fuzzy: query.trim().length > 3 ? 0.2 : false,
        prefix: true,
        boost: { t: 10, d: 3 },
      });

      const sliced = searchResults.slice(0, limit);
      return sliced.map((res) => {
        const fullRecord = mainThreadRecordsMap.get(String(res.id)) || (res as unknown as SearchIndexRecord);
        return {
          id: String(fullRecord.i),
          title: fullRecord.t,
          slug: fullRecord.s,
          coverUrl: fullRecord.c,
          developerNames: Array.isArray(fullRecord.d) ? fullRecord.d.join(", ") : null,
          score: res.score,
        };
      });
    } catch (e) {
      console.warn("Main thread search execution failed:", e);
    }
  }

  return null;
}

// Auto-initialize background load on idle for ALL devices
if (typeof window !== "undefined") {
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(() => initNativeSearch());
  } else {
    setTimeout(() => initNativeSearch(), 500);
  }
}
