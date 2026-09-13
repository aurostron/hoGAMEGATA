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
const GH_OFFSETS_URL = "https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/offsets.json.gz";

// In-memory LRU / Map cache for active worker isolates (protects origin from repeated queries)
const GAME_MEMORY_CACHE = new Map<string, { data: GameDetail; expiresAt: number }>();
const MAX_MEMORY_CACHE_ITEMS = 1000;
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Singleton index maps
let cachedOffsetsMap: Map<string, [number, number]> | null = null;
let cachedIndexArray: CatalogIndexEntry[] | null = null;

function populateOffsetsMap(obj: any): Map<string, [number, number]> {
  const map = new Map<string, [number, number]>();
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item.s && item.o != null && item.l != null) {
        map.set(item.s, [item.o, item.l]);
      }
    }
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v.length >= 2) {
        map.set(k, [v[0], v[1]]);
      }
    }
  }
  return map;
}

/**
 * Loads the slug -> [offset, length] lookup dictionary with tiered fallbacks
 */
export async function getOffsetsMap(): Promise<Map<string, [number, number]>> {
  if (cachedOffsetsMap && cachedOffsetsMap.size > 0) return cachedOffsetsMap;

  // 1. Try local data-export directory first (Dev/Node mode)
  try {
    const localExportPath = path.resolve("data-export/catalog-index.json");
    if (fs.existsSync(localExportPath)) {
      const raw = JSON.parse(fs.readFileSync(localExportPath, "utf8"));
      cachedOffsetsMap = populateOffsetsMap(raw);
      return cachedOffsetsMap;
    }
  } catch {}

  // 2. Try local public catalog offsets
  try {
    const localGz = path.resolve("public/catalog/offsets.json.gz");
    if (fs.existsSync(localGz)) {
      const buf = fs.readFileSync(localGz);
      const decompressed = zlib.gunzipSync(buf).toString("utf8");
      const obj = JSON.parse(decompressed);
      cachedOffsetsMap = populateOffsetsMap(obj);
      return cachedOffsetsMap;
    }
  } catch {}

  // 3. Fetch from GitHub Pages / raw mirror (Production Cloudflare Worker)
  try {
    const res = await fetch(GH_OFFSETS_URL);
    if (res.ok) {
      let obj: any = null;
      if (typeof DecompressionStream !== "undefined") {
        const stream = res.body!.pipeThrough(new DecompressionStream("gzip"));
        const text = await new Response(stream).text();
        obj = JSON.parse(text);
      } else {
        const arrayBuf = await res.arrayBuffer();
        const decompressed = zlib.gunzipSync(Buffer.from(arrayBuf)).toString("utf8");
        obj = JSON.parse(decompressed);
      }
      cachedOffsetsMap = populateOffsetsMap(obj);
      return cachedOffsetsMap;
    }
  } catch (err) {
    console.warn("Failed to load offsets from GitHub mirror:", err);
  }

  return new Map();
}

/**
 * Loads the full catalog index into memory
 */
export async function getCatalogIndex(): Promise<CatalogIndexEntry[]> {
  if (cachedIndexArray) return cachedIndexArray;

  try {
    const localJson = path.resolve("data-export/catalog-index.json");
    if (fs.existsSync(localJson)) {
      cachedIndexArray = JSON.parse(fs.readFileSync(localJson, "utf8"));
      return cachedIndexArray!;
    }
  } catch {}

  try {
    const localGz = path.resolve("public/catalog/catalog-dump.json.gz");
    if (fs.existsSync(localGz)) {
      const buf = fs.readFileSync(localGz);
      const decompressed = zlib.gunzipSync(buf).toString("utf8");
      cachedIndexArray = JSON.parse(decompressed);
      return cachedIndexArray!;
    }
  } catch {}

  return [];
}

/**
 * Fetches complete game details by slug using an exact HTTP Range request (or local disk slice in dev)
 * Optimizations applied:
 * 1. Isolate memory cache (0.01ms lookup for repeated requests)
 * 2. Cloudflare Edge CDN caching (cf.cacheEverything = true, 7 days TTL)
 * 3. Local disk slicing in dev mode (0ms network)
 */
export async function getGameBySlug(slug: string): Promise<GameDetail | null> {
  // 1. Check in-memory isolate cache
  const cached = GAME_MEMORY_CACHE.get(slug);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // 2. Lookup byte offset and length
  if (!cachedOffsetsMap) {
    await getOffsetsMap();
  }

  const coords = cachedOffsetsMap?.get(slug);
  if (!coords) {
    return null;
  }

  const [offset, length] = coords;

  // 3. Local dev mode: zero network delay, direct disk slice read
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

  // Cloudflare fetch options for edge-caching 206 Partial Content
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
    // Evict oldest entry
    const firstKey = GAME_MEMORY_CACHE.keys().next().value;
    if (firstKey) GAME_MEMORY_CACHE.delete(firstKey);
  }
  GAME_MEMORY_CACHE.set(slug, {
    data,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });
}
