/**
 * Client-Side Catalog Search Cache
 * 
 * Caches API query responses in sessionStorage with a 7-day TTL.
 * Slashes redundant network requests during pagination, filtering, and tab switching.
 */

const CACHE_PREFIX = "gata_cat_cache_v1_";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

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
    
    // If cache entry is older than 7 days, expire it
    if (Date.now() - parsed.timestamp > ONE_WEEK_MS) {
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
