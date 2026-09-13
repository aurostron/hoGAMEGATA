import fs from "fs";
import path from "path";
import zlib from "zlib";
import { turso } from "./turso";
import { games as gamesTable } from "../db/schema";
import { gt, and, eq, isNull } from "drizzle-orm";
import { enrichGamesWithRelations } from "./gameQueries";

export interface UpcomingGame {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  developerNames: string | null;
  platformNames: string | null;
  releaseDate: number | null;
  rating: number | null;
  status: string | null;
  category: number | null;
  isTrending: boolean;
  tags?: Array<{ name: string; slug: string }>;
  genres?: Array<{ name: string; slug: string }>;
  purchaseLinks?: Array<{ storeName: string; url: string }>;
  platforms?: Array<{ id?: string; name: string; slug: string }>;
}

let cachedUpcoming: UpcomingGame[] | null = null;
let lastUpcomingFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour memory cache

const UPCOMING_SOURCES = [
  "https://huggingface.co/datasets/aurostron/hogamegata/resolve/main/upcoming-games.json.gz",
  "https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/upcoming-games.json.gz",
  "https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public/upcoming-games.json.gz",
  "https://gamegata.xyz/catalog/upcoming-games.json.gz",
];

export async function getUpcomingGames(): Promise<UpcomingGame[]> {
  const now = Date.now();
  if (cachedUpcoming && (now - lastUpcomingFetchTime) < CACHE_TTL_MS) {
    return cachedUpcoming;
  }

  // 1. Local filesystem check (Dev/Node mode) - instant and 0 cost
  try {
    const localGz = path.resolve("public/catalog/upcoming-games.json.gz");
    if (fs.existsSync(localGz)) {
      const buf = fs.readFileSync(localGz);
      const decompressed = zlib.gunzipSync(buf).toString("utf8");
      cachedUpcoming = JSON.parse(decompressed);
      lastUpcomingFetchTime = now;
      return cachedUpcoming!;
    }
  } catch {}

  // 2. Fetch from static mirrors (Hugging Face / GitHub / CDN)
  const hfToken = (typeof process !== "undefined" && process.env?.HF_TOKEN) || (import.meta as any).env?.HF_TOKEN;

  for (const url of UPCOMING_SOURCES) {
    try {
      const headers: Record<string, string> = {
        "User-Agent": "Gamegata/1.0 (+https://gamegata.xyz)",
      };
      if (url.includes("huggingface.co") && hfToken) {
        headers["Authorization"] = `Bearer ${hfToken}`;
      }

      const res = await fetch(url, { headers });
      if (res.ok) {
        let text: string;
        if (typeof DecompressionStream !== "undefined") {
          const stream = res.body?.pipeThrough(new DecompressionStream("gzip"));
          text = await new Response(stream).text();
        } else {
          const arrayBuf = await res.arrayBuffer();
          text = zlib.gunzipSync(Buffer.from(arrayBuf)).toString("utf8");
        }
        cachedUpcoming = JSON.parse(text);
        if (cachedUpcoming && cachedUpcoming.length > 0) {
          lastUpcomingFetchTime = now;
          return cachedUpcoming;
        }
      }
    } catch (fetchErr) {
      console.warn(`[getUpcomingGames] Failed to fetch from ${url}:`, fetchErr);
    }
  }

  // 3. Fallback: Safe D1 query if offline index is unreachable
  try {
    const nowDate = new Date();
    const selectFields = {
      id: gamesTable.id,
      title: gamesTable.title,
      slug: gamesTable.slug,
      status: gamesTable.status,
      coverUrl: gamesTable.coverUrl,
      isTrending: gamesTable.isTrending,
      category: gamesTable.category,
      developerNames: gamesTable.developerNames,
      releaseDate: gamesTable.releaseDate,
    };
    const [datedUpcoming, tbaUpcoming] = await Promise.all([
      turso
        .select(selectFields)
        .from(gamesTable)
        .where(gt(gamesTable.releaseDate, nowDate))
        .orderBy(gamesTable.releaseDate)
        .limit(150),
      turso
        .select(selectFields)
        .from(gamesTable)
        .where(and(eq(gamesTable.status, "upcoming"), isNull(gamesTable.releaseDate)))
        .limit(50)
    ]);
    const rawGames = [...datedUpcoming, ...tbaUpcoming];
    if (rawGames.length > 0) {
      const enriched = await enrichGamesWithRelations(rawGames);
      cachedUpcoming = enriched.map((g: any) => ({
        ...g,
        releaseDate: g.releaseDate ? new Date(g.releaseDate).getTime() : null,
      }));
      lastUpcomingFetchTime = now;
      return cachedUpcoming;
    }
  } catch (d1Err) {
    console.warn("[getUpcomingGames] D1 query failed safely:", d1Err);
  }

  return cachedUpcoming || [];
}
