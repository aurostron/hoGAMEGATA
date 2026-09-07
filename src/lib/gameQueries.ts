import { turso } from "./turso";
import { gamesToTags, tags, purchaseLinks } from "../db/schema";
import { inArray, eq } from "drizzle-orm";

export interface GameSummary {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  coverUrl: string | null;
  isTrending: boolean;
  rating: number | null;
  category: number | null;
  esrbRating: string | null;
  pegiRating: string | null;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  releaseDate: Date | null;
  rawgEnriched: boolean;
  screenshots: any;
  tags?: Array<{ name: string; slug: string }>;
  purchaseLinks?: Array<{ storeName: string; url: string }>;
  priceSnapshots?: any[];
}

export async function enrichGamesWithRelations(gameList: any[]): Promise<GameSummary[]> {
  if (gameList.length === 0) return [];

  const gameIds = gameList.map(g => g.id);

  // 1 & 2. Fetch tags mapping and purchase links in parallel
  const [tagsResult, linksResult] = await Promise.all([
    turso
      .select({
        gameId: gamesToTags.gameId,
        name: tags.name,
        slug: tags.slug,
      })
      .from(gamesToTags)
      .innerJoin(tags, eq(gamesToTags.tagId, tags.id))
      .where(inArray(gamesToTags.gameId, gameIds)),
    turso
      .select()
      .from(purchaseLinks)
      .where(inArray(purchaseLinks.gameId, gameIds))
  ]);

  // Create lookup maps
  const tagsMap = new Map<string, any[]>();
  for (const t of tagsResult) {
    if (!tagsMap.has(t.gameId)) tagsMap.set(t.gameId, []);
    tagsMap.get(t.gameId)!.push({ name: t.name, slug: t.slug });
  }

  const linksMap = new Map<string, any[]>();
  for (const l of linksResult) {
    if (!linksMap.has(l.gameId)) linksMap.set(l.gameId, []);
    linksMap.get(l.gameId)!.push({ storeName: l.storeName, url: l.url });
  }

  // Map back to games
  return gameList.map(g => {
    let screenshotsParsed = [];
    if (g.screenshots) {
      try {
        screenshotsParsed = typeof g.screenshots === "string" ? JSON.parse(g.screenshots) : g.screenshots;
      } catch (e) {
        screenshotsParsed = [];
      }
    }
    return {
      ...g,
      screenshots: screenshotsParsed,
      tags: tagsMap.get(g.id) || [],
      purchaseLinks: linksMap.get(g.id) || [],
    };
  });
}
