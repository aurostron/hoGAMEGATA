import "./load-env";

import { turso, initTursoForRequest } from "../src/lib/turso";
initTursoForRequest(process.env);
import * as schema from "../src/db/schema";
import { eq, and, or, inArray, count, like, not, isNull, isNotNull, sql } from "drizzle-orm";
import * as crypto from "crypto";

export { turso, schema };
export * from "drizzle-orm";

export function generateId(): string {
  return crypto.randomUUID();
}

// Helper to convert array or object screenshots/scareProfile/taxonomyScores to string if needed
function stringifyIfNeeded(val: any): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val);
  } catch {
    return null;
  }
}

export async function getOrCreateDeveloper(name: string, slug: string, igdbId?: number | null, avatarUrl?: string | null): Promise<string> {
  const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  // Try by slug
  const [existing] = await turso
    .select()
    .from(schema.developers)
    .where(eq(schema.developers.slug, cleanSlug))
    .limit(1);

  if (existing) {
    // Update if needed
    const updateData: any = {};
    if (igdbId && !existing.igdbId) updateData.igdbId = igdbId;
    if (avatarUrl && !existing.avatarUrl) updateData.avatarUrl = avatarUrl;
    
    if (Object.keys(updateData).length > 0) {
      await turso
        .update(schema.developers)
        .set(updateData)
        .where(eq(schema.developers.id, existing.id));
    }
    return existing.id;
  }

  // Create new
  const id = generateId();
  await turso.insert(schema.developers).values({
    id,
    name,
    slug: cleanSlug,
    igdbId: igdbId || null,
    avatarUrl: avatarUrl || null
  }).onConflictDoNothing();

  return id;
}

export async function getOrCreatePublisher(name: string, slug: string, igdbId?: number | null): Promise<string> {
  const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  const [existing] = await turso
    .select()
    .from(schema.publishers)
    .where(eq(schema.publishers.slug, cleanSlug))
    .limit(1);

  if (existing) {
    if (igdbId && !existing.igdbId) {
      await turso
        .update(schema.publishers)
        .set({ igdbId })
        .where(eq(schema.publishers.id, existing.id));
    }
    return existing.id;
  }

  const id = generateId();
  await turso.insert(schema.publishers).values({
    id,
    name,
    slug: cleanSlug,
    igdbId: igdbId || null
  }).onConflictDoNothing();

  return id;
}

export async function getOrCreatePlatform(name: string, slug: string, igdbId?: number | null): Promise<string> {
  const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  const [existing] = await turso
    .select()
    .from(schema.platforms)
    .where(eq(schema.platforms.slug, cleanSlug))
    .limit(1);

  if (existing) {
    if (igdbId && !existing.igdbId) {
      await turso
        .update(schema.platforms)
        .set({ igdbId })
        .where(eq(schema.platforms.id, existing.id));
    }
    return existing.id;
  }

  const id = generateId();
  await turso.insert(schema.platforms).values({
    id,
    name,
    slug: cleanSlug,
    igdbId: igdbId || null
  }).onConflictDoNothing();

  return id;
}

export async function getOrCreateGenre(name: string, slug: string, igdbId?: number | null): Promise<string> {
  const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  const [existing] = await turso
    .select()
    .from(schema.genres)
    .where(eq(schema.genres.slug, cleanSlug))
    .limit(1);

  if (existing) {
    if (igdbId && !existing.igdbId) {
      await turso
        .update(schema.genres)
        .set({ igdbId })
        .where(eq(schema.genres.id, existing.id));
    }
    return existing.id;
  }

  const id = generateId();
  await turso.insert(schema.genres).values({
    id,
    name,
    slug: cleanSlug,
    igdbId: igdbId || null
  }).onConflictDoNothing();

  return id;
}

export async function getOrCreateTag(name: string, slug: string): Promise<string> {
  const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  const [existing] = await turso
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.slug, cleanSlug))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const id = generateId();
  await turso.insert(schema.tags).values({
    id,
    name,
    slug: cleanSlug
  }).onConflictDoNothing();

  return id;
}

interface SaveGameParams {
  id?: string;
  igdbId?: number | null;
  title: string;
  slug: string;
  summary?: string | null;
  storyline?: string | null;
  releaseDate?: Date | null;
  status?: string | null;
  coverUrl?: string | null;
  rating?: number | null;
  popularity?: number | null;
  trailerUrl?: string | null;
  screenshots?: any;
  isTrending?: boolean;
  category?: number | null;
  developerNames?: string | null;
  genreNames?: string | null;
  platformNames?: string | null;
  source?: string | null;
  rawgEnriched?: boolean;
  rawgRating?: number | null;
  rawgSlug?: string | null;
  rawgId?: number | null;
  lastRawgSync?: Date | null;
  metacritic?: number | null;
  metacriticUrl?: string | null;
  playtime?: number | null;
  esrbRating?: string | null;
  pegiRating?: string | null;
  redditUrl?: string | null;
  websiteUrl?: string | null;
  steamRating?: number | null;
  steamRatingDesc?: string | null;
  lastSteamSync?: Date | null;
  scareRating?: number | null;
  scareProfile?: any;
  scareReviewCount?: number | null;
  lastScareSync?: Date | null;
  protonDbTier?: string | null;
  protonDbConfidence?: string | null;
  protonDbScore?: number | null;
  protonDbTotalReports?: number | null;
  lastProtonDbSync?: Date | null;
  taxonomyScores?: any;
  
  // Relations
  developerIds?: string[];
  publisherIds?: string[];
  genreIds?: string[];
  platformIds?: string[];
  tagIds?: string[];
  purchaseLinks?: Array<{ storeName: string; url: string }>;
}

export async function saveGame(params: SaveGameParams): Promise<string> {
  const slug = params.slug || params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  // Find if game exists
  let gameId = params.id;
  if (!gameId) {
    let existing;
    if (params.igdbId !== undefined && params.igdbId !== null) {
      [existing] = await turso
        .select()
        .from(schema.games)
        .where(eq(schema.games.igdbId, params.igdbId))
        .limit(1);
    }
    if (!existing) {
      [existing] = await turso
        .select()
        .from(schema.games)
        .where(eq(schema.games.slug, slug))
        .limit(1);
    }
    if (existing) {
      gameId = existing.id;
    }
  }

  const isCreate = !gameId;
  const activeId = gameId || generateId();

  const gameRow: any = {
    title: params.title,
    slug: slug,
    summary: params.summary || null,
    storyline: params.storyline || null,
    releaseDate: params.releaseDate || null,
    status: params.status || null,
    coverUrl: params.coverUrl || null,
    rating: params.rating || null,
    popularity: params.popularity || null,
    trailerUrl: params.trailerUrl || null,
    screenshots: stringifyIfNeeded(params.screenshots),
    isTrending: params.isTrending !== undefined ? params.isTrending : false,
    category: params.category !== undefined ? params.category : null,
    developerNames: params.developerNames || null,
    genreNames: params.genreNames || null,
    platformNames: params.platformNames || null,
    source: params.source || null,
    updatedAt: new Date()
  };

  if (params.igdbId !== undefined) gameRow.igdbId = params.igdbId;
  if (params.rawgEnriched !== undefined) gameRow.rawgEnriched = params.rawgEnriched;
  if (params.rawgRating !== undefined) gameRow.rawgRating = params.rawgRating;
  if (params.rawgSlug !== undefined) gameRow.rawgSlug = params.rawgSlug;
  if (params.rawgId !== undefined) gameRow.rawgId = params.rawgId;
  if (params.lastRawgSync !== undefined) gameRow.lastRawgSync = params.lastRawgSync;
  if (params.metacritic !== undefined) gameRow.metacritic = params.metacritic;
  if (params.metacriticUrl !== undefined) gameRow.metacriticUrl = params.metacriticUrl;
  if (params.playtime !== undefined) gameRow.playtime = params.playtime;
  if (params.esrbRating !== undefined) gameRow.esrbRating = params.esrbRating;
  if (params.pegiRating !== undefined) gameRow.pegiRating = params.pegiRating;
  if (params.redditUrl !== undefined) gameRow.redditUrl = params.redditUrl;
  if (params.websiteUrl !== undefined) gameRow.websiteUrl = params.websiteUrl;
  if (params.steamRating !== undefined) gameRow.steamRating = params.steamRating;
  if (params.steamRatingDesc !== undefined) gameRow.steamRatingDesc = params.steamRatingDesc;
  if (params.lastSteamSync !== undefined) gameRow.lastSteamSync = params.lastSteamSync;
  if (params.scareRating !== undefined) gameRow.scareRating = params.scareRating;
  if (params.scareProfile !== undefined) gameRow.scareProfile = stringifyIfNeeded(params.scareProfile);
  if (params.scareReviewCount !== undefined) gameRow.scareReviewCount = params.scareReviewCount;
  if (params.lastScareSync !== undefined) gameRow.lastScareSync = params.lastScareSync;
  if (params.protonDbTier !== undefined) gameRow.protonDbTier = params.protonDbTier;
  if (params.protonDbConfidence !== undefined) gameRow.protonDbConfidence = params.protonDbConfidence;
  if (params.protonDbScore !== undefined) gameRow.protonDbScore = params.protonDbScore;
  if (params.protonDbTotalReports !== undefined) gameRow.protonDbTotalReports = params.protonDbTotalReports;
  if (params.lastProtonDbSync !== undefined) gameRow.lastProtonDbSync = params.lastProtonDbSync;
  if (params.taxonomyScores !== undefined) gameRow.taxonomyScores = stringifyIfNeeded(params.taxonomyScores);

  if (isCreate) {
    gameRow.id = activeId;
    gameRow.createdAt = new Date();
    await turso.insert(schema.games).values(gameRow);
  } else {
    await turso.update(schema.games).set(gameRow).where(eq(schema.games.id, activeId));
  }

  // Relations
  if (params.developerIds) {
    await turso.delete(schema.gamesToDevelopers).where(eq(schema.gamesToDevelopers.gameId, activeId));
    if (params.developerIds.length > 0) {
      await turso.insert(schema.gamesToDevelopers).values(params.developerIds.map(dId => ({ gameId: activeId, developerId: dId })));
    }
  }
  if (params.publisherIds) {
    await turso.delete(schema.gamesToPublishers).where(eq(schema.gamesToPublishers.gameId, activeId));
    if (params.publisherIds.length > 0) {
      await turso.insert(schema.gamesToPublishers).values(params.publisherIds.map(pId => ({ gameId: activeId, publisherId: pId })));
    }
  }
  if (params.genreIds) {
    await turso.delete(schema.gamesToGenres).where(eq(schema.gamesToGenres.gameId, activeId));
    if (params.genreIds.length > 0) {
      await turso.insert(schema.gamesToGenres).values(params.genreIds.map(gId => ({ gameId: activeId, genreId: gId })));
    }
  }
  if (params.platformIds) {
    await turso.delete(schema.gamesToPlatforms).where(eq(schema.gamesToPlatforms.gameId, activeId));
    if (params.platformIds.length > 0) {
      await turso.insert(schema.gamesToPlatforms).values(params.platformIds.map(plId => ({ gameId: activeId, platformId: plId })));
    }
  }
  if (params.tagIds) {
    await turso.delete(schema.gamesToTags).where(eq(schema.gamesToTags.gameId, activeId));
    if (params.tagIds.length > 0) {
      await turso.insert(schema.gamesToTags).values(params.tagIds.map(tId => ({ gameId: activeId, tagId: tId })));
    }
  }

  // Purchase links
  if (params.purchaseLinks) {
    await turso.delete(schema.purchaseLinks).where(eq(schema.purchaseLinks.gameId, activeId));
    if (params.purchaseLinks.length > 0) {
      await turso.insert(schema.purchaseLinks).values(
        params.purchaseLinks.map(pl => ({
          id: generateId(),
          storeName: pl.storeName,
          url: pl.url,
          gameId: activeId
        }))
      );
    }
  }

  return activeId;
}

interface PriceSnapshotParams {
  gameId: string;
  storeName: string;
  dealPrice: number;
  retailPrice: number;
  discountPercent: number;
  dealUrl: string;
  currency?: string;
  country?: string;
}

export async function savePriceSnapshot(params: PriceSnapshotParams) {
  const storeName = params.storeName;
  const country = params.country || "US";
  const currency = params.currency || "USD";

  const [existing] = await turso
    .select()
    .from(schema.priceSnapshots)
    .where(
      and(
        eq(schema.priceSnapshots.gameId, params.gameId),
        eq(schema.priceSnapshots.storeName, storeName),
        eq(schema.priceSnapshots.country, country)
      )
    )
    .limit(1);

  if (existing) {
    await turso
      .update(schema.priceSnapshots)
      .set({
        dealPrice: params.dealPrice,
        retailPrice: params.retailPrice,
        discountPercent: params.discountPercent,
        dealUrl: params.dealUrl,
        currency,
        updatedAt: new Date()
      })
      .where(eq(schema.priceSnapshots.id, existing.id));
  } else {
    await turso.insert(schema.priceSnapshots).values({
      id: generateId(),
      gameId: params.gameId,
      storeName,
      dealPrice: params.dealPrice,
      retailPrice: params.retailPrice,
      discountPercent: params.discountPercent,
      dealUrl: params.dealUrl,
      currency,
      country,
      updatedAt: new Date()
    });
  }
}
