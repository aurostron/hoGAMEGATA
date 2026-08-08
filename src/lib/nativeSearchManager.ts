/**
 * Desktop Native Search Manager
 * 
 * Manages background downloading, IndexedDB caching, and Web Worker execution
 * for 0ms latency, typo-tolerant native desktop search.
 */

export interface NativeSearchResult {
  id: number;
  title: string;
  slug: string;
  coverUrl: string | null;
  rating: number | null;
  steamRating: number | null;
  scareRating: number | null;
  releaseYear: number | null;
  developers: string[];
  genres: string[];
  score: number;
}

const IDB_NAME = "GamegataSearchDB";
const IDB_STORE = "catalog_index";
const IDB_VERSION = 1;
const PREF_KEY = "gamegata_native_search_enabled";

let workerInstance: Worker | null = null;
let isWorkerReady = false;
let messageIdCounter = 0;
const pendingCallbacks = new Map<number, (data: any) => void>();

// Helper: Check if device is Desktop (non-touch or large screen)
export function isDesktopDevice(): boolean {
  if (typeof window === "undefined") return false;
  
  // User setting override check
  const preference = localStorage.getItem(PREF_KEY);
  if (preference !== null) {
    return preference === "true";
  }

  // Auto-detect Desktop vs Mobile
  const userAgent = navigator.userAgent || "";
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isSmallScreen = window.innerWidth < 768;

  return !isMobileUA && !isSmallScreen;
}

// User preference getter/setter
export function getNativeSearchPreference(): boolean {
  return isDesktopDevice();
}

export function setNativeSearchPreference(enabled: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PREF_KEY, enabled ? "true" : "false");
  }
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

async function getCachedRecords(): Promise<{ records: any[]; timestamp: number } | null> {
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

async function saveCachedRecords(records: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.put({ records, timestamp: Date.now() }, "latest");
  } catch (e) {
    console.warn("Failed to cache search index in IndexedDB:", e);
  }
}

// Spawn and initialize worker
export async function initNativeSearch(): Promise<boolean> {
  if (typeof window === "undefined" || isWorkerReady) return isWorkerReady;

  if (!isDesktopDevice()) {
    return false;
  }

  try {
    // 1. Create Web Worker instance
    if (!workerInstance) {
      workerInstance = new Worker(
        new URL("../workers/searchWorker.ts", import.meta.url),
        { type: "module" }
      );

      workerInstance.onmessage = (event) => {
        const { id, type, error, results } = event.data;
        const callback = pendingCallbacks.get(id);
        if (callback) {
          pendingCallbacks.delete(id);
          if (type.endsWith("_ERROR")) {
            callback({ error });
          } else {
            callback(results || event.data);
          }
        }
      };
    }

    // 2. Try loading from IndexedDB first for instant startup
    const cached = await getCachedRecords();
    if (cached && cached.records && cached.records.length > 0) {
      sendWorkerMessage("INIT_INDEX", cached.records).then(() => {
        isWorkerReady = true;
      });

      // Background revalidate if cache is older than 24 hours
      if (Date.now() - cached.timestamp > 86400000) {
        fetchFreshIndex();
      }
      return true;
    }

    // 3. Otherwise fetch fresh search-index.json
    return await fetchFreshIndex();
  } catch (e) {
    console.warn("Failed to initialize native search engine:", e);
    return false;
  }
}

async function fetchFreshIndex(): Promise<boolean> {
  try {
    const res = await fetch("/search-index.json", { cache: "default" });
    if (!res.ok) return false;
    const records = await res.json();
    if (Array.isArray(records) && records.length > 0) {
      await saveCachedRecords(records);
      await sendWorkerMessage("INIT_INDEX", records);
      isWorkerReady = true;
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

// Public Native Search Function
export async function searchNative(query: string, limit = 20): Promise<NativeSearchResult[] | null> {
  if (!query || !query.trim()) return [];

  // Initialize if not already done
  if (!isWorkerReady) {
    const ok = await initNativeSearch();
    if (!ok || !isWorkerReady) return null; // fallback to cloud API
  }

  try {
    const response = await sendWorkerMessage("SEARCH", { query, limit });
    if (response && Array.isArray(response.results)) {
      return response.results;
    }
  } catch (e) {
    console.warn("Native search execution failed:", e);
  }

  return null; // fallback to cloud API
}

// Auto-initialize background load on idle for desktop
if (typeof window !== "undefined") {
  if (isDesktopDevice()) {
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => initNativeSearch());
    } else {
      setTimeout(() => initNativeSearch(), 1000);
    }
  }
}
