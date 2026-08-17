/**
 * Client-Side Catalog Search Cache
 * 
 * Caches API query responses in sessionStorage with a 7-day TTL.
 * Slashes redundant network requests during pagination, filtering, and tab switching.
 */

const CACHE_PREFIX = "gata_cat_cache_v2_";
const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour TTL for fresh counts

// Automatically clear legacy v1 caches on load
if (typeof window !== "undefined") {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith("gata_cat_cache_v1_") || !k.startsWith(CACHE_PREFIX))) {
        if (k.startsWith("gata_cat_cache_")) {
          sessionStorage.removeItem(k);
        }
      }
    }
  } catch {}
}

interface CachedPayload {
  timestamp: number;
  data: any;
}

export function getCachedCatalogResponse(key: string): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed: CachedPayload = JSON.parse(raw);
    
    // If cache entry is older than 1 hour, expire it
    if (Date.now() - parsed.timestamp > ONE_HOUR_MS) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedCatalogResponse(key: string, data: any): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedPayload = {
      timestamp: Date.now(),
      data
    };
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch (e) {
    // If storage limit is exceeded, clear old cache entries and retry
    clearOldCatalogCache();
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ timestamp: Date.now(), data }));
    } catch {}
  }
}

function clearOldCatalogCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch {}
}
