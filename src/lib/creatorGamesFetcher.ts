import fs from "fs";
import path from "path";
import zlib from "zlib";

export interface CreatorGameCard {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  developerNames: string | null;
  platformNames: string | null;
  releaseDate: number | null;
  rating: number | null;
  status: string | null;
}

let cachedCreatorIndex: Record<string, CreatorGameCard[]> | null = null;
const CREATOR_INDEX_SOURCES = [
  "https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/18c9c109c28106e74b9fc4520e63da1298f4fe30/docs/public/creator-games.json.gz",
  "https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/creator-games.json.gz",
  "https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public/creator-games.json.gz",
  "https://gamegata.xyz/catalog/creator-games.json.gz",
];

export async function getCreatorGamesIndex(): Promise<Record<string, CreatorGameCard[]>> {
  if (cachedCreatorIndex) return cachedCreatorIndex;

  // 1. Local filesystem check (Dev/Node mode)
  try {
    const localGz = path.resolve("public/catalog/creator-games.json.gz");
    if (fs.existsSync(localGz)) {
      const buf = fs.readFileSync(localGz);
      const decompressed = zlib.gunzipSync(buf).toString("utf8");
      cachedCreatorIndex = JSON.parse(decompressed);
      return cachedCreatorIndex!;
    }
  } catch {}

  // 2. Fetch from static mirror / CDN / GitHub (Production Cloudflare Worker)
  for (const url of CREATOR_INDEX_SOURCES) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Gamegata/1.0 (+https://gamegata.xyz)" }
      });
      if (res.ok) {
        if (typeof DecompressionStream !== "undefined") {
          const stream = res.body?.pipeThrough(new DecompressionStream("gzip"));
          const text = await new Response(stream).text();
          cachedCreatorIndex = JSON.parse(text);
        } else {
          const arrayBuf = await res.arrayBuffer();
          const decompressed = zlib.gunzipSync(Buffer.from(arrayBuf)).toString("utf8");
          cachedCreatorIndex = JSON.parse(decompressed);
        }
        if (cachedCreatorIndex && Object.keys(cachedCreatorIndex).length > 0) {
          return cachedCreatorIndex;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch creator games index from ${url}:`, err);
    }
  }

  return {};
}

export async function getGamesByCreatorSlugs(
  slugs: string[],
  excludeIdOrSlug?: string,
  limit = 8
): Promise<CreatorGameCard[]> {
  const index = await getCreatorGamesIndex();
  const results: CreatorGameCard[] = [];
  const seen = new Set<string>();

  if (excludeIdOrSlug) {
    seen.add(excludeIdOrSlug);
  }

  for (const slug of slugs) {
    const games = index[slug] || [];
    for (const g of games) {
      if (!seen.has(g.slug) && (!excludeIdOrSlug || (g.id !== excludeIdOrSlug && g.slug !== excludeIdOrSlug))) {
        seen.add(g.slug);
        seen.add(g.id);
        results.push(g);
        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}
