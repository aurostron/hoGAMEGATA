import fs from "fs";
import path from "path";
import zlib from "zlib";
import { turso } from "./turso";
import { developers as developersTable, games as gamesTable, gamesToDevelopers } from "../db/schema";
import { eq, inArray, and, or, isNull, ne } from "drizzle-orm";

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
  category?: number | null;
  summary?: string | null;
  genres?: Array<{ name: string; slug: string }>;
  tags?: Array<{ name: string; slug: string }>;
  platforms?: Array<{ id?: string; name: string; slug: string }>;
}

export interface CreatorProfile {
  name: string;
  slug: string;
  avatarUrl?: string | null;
  description?: string | null;
  location?: string | null;
  style?: string | null;
  games: CreatorGameCard[];
}

export interface DeveloperData {
  developer: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    description: string | null;
    location?: string | null;
    style?: string | null;
  };
  games: CreatorGameCard[];
}

let cachedCreatorIndex: Record<string, CreatorProfile | CreatorGameCard[]> | null = null;

const CREATOR_INDEX_SOURCES = [
  "https://huggingface.co/datasets/aurostron/hogamegata/resolve/main/creator-games.json.gz",
  "https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/creator-games.json.gz",
  "https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public/creator-games.json.gz",
  "https://gamegata.xyz/catalog/creator-games.json.gz",
];

const STOREFRONT_NAMES = new Set([
  "gog-com", "gog", "steam", "itch-io", "itch", "epic-games", "epic-games-store", "nintendo-eshop", "playstation-store", "xbox-store", "humble-bundle"
]);

const DEV_CURATED_DATA: Record<string, { description?: string; location?: string; style?: string }> = {
  "chillas-art": {
    description: "Chilla's Art (チルズアート) is a legendary Japanese indie game developer duo known for pioneering the VHS aesthetic in psychological horror, capturing Japanese urban legends, and delivering dread-inducing gaming masterpieces.",
    location: "Japan",
    style: "VHS, Atmospheric Horror"
  },
  "deep-sea-prisoner": {
    description: "Deep-Sea Prisoner (Funamusea) is a Japanese indie creator famous for highly narrative, atmospheric adventure horror titles like Mogeko Castle and The Gray Garden.",
    location: "Japan",
    style: "Adventure, Psychological Horror"
  },
  "limbolane": {
    description: "LimboLane is an independent game studio creators of the surreal psychological adventure game Smile For Me.",
    location: "USA",
    style: "Surreal, Puzzle Adventure"
  }
};

export async function getCreatorGamesIndex(): Promise<Record<string, CreatorProfile | CreatorGameCard[]>> {
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

  // 2. Fetch from static mirror / CDN / Hugging Face / GitHub (Production Cloudflare Worker)
  const hfToken = (typeof process !== "undefined" && process.env?.HF_TOKEN) || (import.meta as any).env?.HF_TOKEN;

  for (const url of CREATOR_INDEX_SOURCES) {
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
        cachedCreatorIndex = JSON.parse(text);
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
    const entry = index[slug];
    const games: CreatorGameCard[] = Array.isArray(entry) ? entry : (entry?.games || []);
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

async function withTimeout<T>(promise: Promise<T>, ms: number = 2000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function getDeveloperData(slug: string): Promise<DeveloperData | null> {
  const cleanSlug = slug.toLowerCase().trim();
  if (!cleanSlug || STOREFRONT_NAMES.has(cleanSlug)) {
    return null;
  }

  const curated = DEV_CURATED_DATA[cleanSlug] || {};

  // Tier 1: Check offline Creator Index (from local public/catalog or HF/GitHub mirror)
  const index = await getCreatorGamesIndex();
  const entry = index[cleanSlug];

  let offlineGames: CreatorGameCard[] = [];
  let developerName: string = cleanSlug;

  if (entry) {
    if (Array.isArray(entry)) {
      offlineGames = entry;
      developerName = offlineGames[0]?.developerNames?.split(",")[0]?.trim() || cleanSlug;
    } else {
      offlineGames = entry.games || [];
      developerName = entry.name || offlineGames[0]?.developerNames?.split(",")[0]?.trim() || cleanSlug;
    }
  }

  // Tier 2: Safe, non-blocking D1 query for avatar or real developer ID if available (with strict timeout)
  let avatarUrl: string | null = null;
  let devId: string = cleanSlug;
  let d1DeveloperFound = false;

  try {
    const [devRow] = await withTimeout(
      turso
        .select()
        .from(developersTable)
        .where(eq(developersTable.slug, cleanSlug))
        .limit(1),
      1500
    );

    if (devRow) {
      d1DeveloperFound = true;
      devId = devRow.id;
      developerName = devRow.name || developerName;
      avatarUrl = devRow.avatarUrl || null;
    }
  } catch (d1Err) {
    // D1 quota exceeded or network error — fail safe, no 500 error!
    console.warn(`[getDeveloperData] D1 query for developer '${cleanSlug}' failed safely:`, d1Err);
  }

  // If we have offline games, sort them chronologically (releaseDate ascending, TBA last)
  if (offlineGames.length > 0) {
    const sortedGames = [...offlineGames].sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 9999999999999;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 9999999999999;
      return dateA - dateB;
    });

    return {
      developer: {
        id: devId,
        name: developerName,
        slug: cleanSlug,
        avatarUrl,
        description: curated.description || null,
        location: curated.location || null,
        style: curated.style || null,
      },
      games: sortedGames,
    };
  }

  // If creator was not in offline index but exists in D1, attempt safe D1 games query
  if (d1DeveloperFound) {
    try {
      const gameRelations = await withTimeout(
        turso
          .select({ gameId: gamesToDevelopers.gameId })
          .from(gamesToDevelopers)
          .where(eq(gamesToDevelopers.developerId, devId)),
        1500
      );

      const gameIds = gameRelations.map((r: any) => r.gameId);
      if (gameIds.length > 0) {
        const fetchedGames = await withTimeout(
          turso
            .select()
            .from(gamesTable)
            .where(
              and(
                inArray(gamesTable.id, gameIds),
                or(isNull(gamesTable.status), ne(gamesTable.status, "hidden"))
              )
            )
            .orderBy(gamesTable.releaseDate),
          2000
        );

        return {
          developer: {
            id: devId,
            name: developerName,
            slug: cleanSlug,
            avatarUrl,
            description: curated.description || null,
            location: curated.location || null,
            style: curated.style || null,
          },
          games: fetchedGames.map((g: any) => ({
            ...g,
            releaseDate: g.releaseDate ? new Date(g.releaseDate).getTime() : null,
          })),
        };
      }
    } catch (d1GamesErr) {
      console.warn(`[getDeveloperData] D1 games query failed for '${cleanSlug}':`, d1GamesErr);
    }
  }

  // Not found anywhere
  return null;
}

