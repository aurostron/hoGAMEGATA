import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export interface GameDetail {
  id: string;
  igdbId: number | null;
  title: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  releaseDate: number | null;
  status: string;
  coverUrl: string | null;
  rating: number | null;
  trailerUrl: string | null;
  screenshots: string[];
  catboxAlbumId: string | null;
  metacritic: number | null;
  metacriticUrl: string | null;
  playtime: number | null;
  esrbRating: string | null;
  pegiRating: string | null;
  redditUrl: string | null;
  websiteUrl: string | null;
  rawgRating: number | null;
  rawgSlug: string | null;
  steamRating: number | null;
  steamRatingDesc: string | null;
  scareRating: number | null;
  scareProfile: any;
  scareReviewCount: number | null;
  protonDbTier: string | null;
  protonDbConfidence: string | null;
  protonDbScore: number | null;
  minRequirements: string | null;
  recRequirements: string | null;
  popularity: number | null;
  isTrending: boolean;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  source: string | null;
  taxonomyScores: any;
  devs: { name: string; slug: string }[];
  pubs: { name: string; slug: string }[];
  genres: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  platforms: { name: string; slug: string }[];
  purchaseLinks: { storeName: string; url: string }[];
  priceSnapshots: {
    storeName: string;
    dealPrice: number | null;
    retailPrice: number | null;
    discountPercent: number | null;
    dealUrl: string | null;
    currency: string | null;
    country: string | null;
    provider: string | null;
  }[];
}

export interface CatalogIndexEntry {
  i: string;
  t: string;
  s: string;
  c: string | null;
  rd: number | null;
  rt: number | null;
  pop: number | null;
  tr: number;
  dn: string | null;
  gn: string | null;
  pn: string | null;
  o: number;
  l: number;
}

const HF_DATASET_BASE = "https://huggingface.co/datasets/aurostron/hogamegata/resolve/main";
const HF_RAW_URL = `${HF_DATASET_BASE}/catalog.raw`;
const JSDELIVR_OFFSETS_BASE = "https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public/offsets";
const GH_RAW_OFFSETS_BASE = "https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/offsets";

// In-memory LRU / Map cache for active worker isolates (protects origin from repeated queries)
const GAME_MEMORY_CACHE = new Map<string, { data: GameDetail; expiresAt: number }>();
const MAX_MEMORY_CACHE_ITEMS = 1000;
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory cache for loaded offset shards (each shard is only ~20-50 KB)
const SHARD_CACHE = new Map<string, Record<string, [number, number]>>();

/**
 * Normalizes slug to determine its shard key:
 * - strips leading "itch-" so itch titles are distributed across letters
 * - returns 'a'..'z' or '_num'
 */
export function getShardKey(slug: string): string {
  let s = slug.toLowerCase().trim();
  if (s.startsWith("itch-")) {
    s = s.slice(5);
  }
  const firstChar = s.charAt(0);
  if (!firstChar || !/[a-z]/.test(firstChar)) {
    return "_num";
  }
  return firstChar;
}

/**
 * Fast lookup for a single game's byte offset and length in the master catalog.
 * Uses sharded JSON files (~30 KB each) instead of loading a monolithic 15 MB file.
 */
export async function getGameCoords(slugOrId: string): Promise<[number, number] | null> {
  const shardKey = getShardKey(slugOrId);

  // 1. Check in-memory isolate shard cache
  let dict = SHARD_CACHE.get(shardKey);
  if (dict) {
    return dict[slugOrId] || null;
  }

  // 2. Try local dev file system (zero network delay)
  try {
    const localShardPath = path.resolve(`public/catalog/offsets/${shardKey}.json`);
    if (fs.existsSync(localShardPath)) {
      dict = JSON.parse(fs.readFileSync(localShardPath, "utf8"));
      if (dict) {
        SHARD_CACHE.set(shardKey, dict);
        return dict[slugOrId] || null;
      }
    }
  } catch {}

  // 3. Fetch shard via jsDelivr CDN (~15-30ms, globally edge cached)
  try {
    const shardUrl = `${JSDELIVR_OFFSETS_BASE}/${shardKey}.json`;
    const fetchOptions: any = {
      headers: { Accept: "application/json" },
    };
    if (typeof (globalThis as any).caches !== "undefined") {
      fetchOptions.cf = {
        cacheEverything: true,
        cacheTtl: 604800, // 7 days in Cloudflare Edge Cache
      };
    }

    const res = await fetch(shardUrl, fetchOptions);
    if (res.ok) {
      dict = await res.json();
      if (dict) {
        SHARD_CACHE.set(shardKey, dict);
        return dict[slugOrId] || null;
      }
    }
  } catch (e) {
    console.warn(`[GamePack] jsDelivr shard fetch error for shard ${shardKey}:`, e);
  }

  // 4. Fallback to GitHub raw mirror
  try {
    const ghUrl = `${GH_RAW_OFFSETS_BASE}/${shardKey}.json`;
    const res = await fetch(ghUrl);
    if (res.ok) {
      dict = await res.json();
      if (dict) {
        SHARD_CACHE.set(shardKey, dict);
        return dict[slugOrId] || null;
      }
    }
  } catch (err) {
    console.warn(`[GamePack] GitHub raw shard fetch error for shard ${shardKey}:`, err);
  }

  return null;
}

/**
 * Backward-compatible helper for legacy callers
 */
export async function getOffsetsMap(): Promise<Map<string, [number, number]>> {
  // If needed, load the current shard or return empty map (components now use getGameCoords)
  return new Map();
}

/**
 * Loads the full catalog index into memory (used in background jobs or dev scripts)
 */
export async function getCatalogIndex(): Promise<CatalogIndexEntry[]> {
  try {
    const localGz = path.resolve("public/catalog/catalog-dump.json.gz");
    if (fs.existsSync(localGz)) {
      const buf = fs.readFileSync(localGz);
      const decompressed = zlib.gunzipSync(buf).toString("utf8");
      return JSON.parse(decompressed);
    }
  } catch {}

  return [];
}

/**
 * Fetches complete game details by slug using an exact HTTP Range request (or local disk slice in dev)
 * Optimizations applied:
 * 1. Isolate memory cache (0.01ms lookup for repeated requests)
 * 2. 27-shard lightweight offset indices (~30 KB vs 15 MB)
 * 3. Cloudflare Edge CDN caching (cf.cacheEverything = true, 7 days TTL)
 * 4. Local disk slicing in dev mode (0ms network)
 */
export async function getGameBySlug(slug: string): Promise<GameDetail | null> {
  // 1. Check in-memory isolate cache
  const cached = GAME_MEMORY_CACHE.get(slug);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // 2. Lookup byte offset and length via sharded index
  const coords = await getGameCoords(slug);
  if (!coords) {
    return null;
  }

  const [offset, length] = coords;

  // 3. Local dev mode: zero network delay, direct disk slice read if file exists
  try {
    const localRawPath = path.resolve("data-export/catalog.raw");
    if (fs.existsSync(localRawPath)) {
      const fd = fs.openSync(localRawPath, "r");
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, offset);
      fs.closeSync(fd);
      const data = JSON.parse(buffer.toString("utf8")) as GameDetail;
      setMemoryCache(slug, data);
      return data;
    }
  } catch {}

  // 4. Production mode: HTTP Range request to Hugging Face with edge-caching instructions
  const rangeHeader = `bytes=${offset}-${offset + length - 1}`;

  const fetchOptions: any = {
    headers: {
      Range: rangeHeader,
      "User-Agent": "Gamegata/1.0 (+https://gamegata.xyz)",
    },
    redirect: "follow",
  };

  // If running inside Cloudflare Workers environment, tell CF Edge to cache everything
  if (typeof (globalThis as any).caches !== "undefined") {
    fetchOptions.cf = {
      cacheEverything: true,
      cacheTtl: 604800, // 7 days in Cloudflare Edge Cache
    };
  }

  const res = await fetch(HF_RAW_URL, fetchOptions);

  if (!res.ok && res.status !== 206) {
    console.error(`Failed to fetch slice for ${slug} (${res.status}): ${rangeHeader}`);
    return null;
  }

  const data = (await res.json()) as GameDetail;
  setMemoryCache(slug, data);
  return data;
}

function setMemoryCache(slug: string, data: GameDetail) {
  if (GAME_MEMORY_CACHE.size >= MAX_MEMORY_CACHE_ITEMS) {
    const firstKey = GAME_MEMORY_CACHE.keys().next().value;
    if (firstKey) GAME_MEMORY_CACHE.delete(firstKey);
  }
  GAME_MEMORY_CACHE.set(slug, {
    data,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });
}
