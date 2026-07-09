import { turso } from "./turso";
import { analyticsEvents, analyticsDaily } from "../db/schema";
import { sql } from "drizzle-orm";

/**
 * Helper to get the current date in YYYY-MM-DD format.
 */
function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Probability-based prune: deletes raw events older than 30 days
 * with a 2% chance on any tracking event.
 */
function maybePruneOldEvents() {
  if (Math.random() < 0.02) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const pruneDate = thirtyDaysAgo.toISOString().split("T")[0];
    
    turso
      .delete(analyticsEvents)
      .where(sql`${analyticsEvents.date} < ${pruneDate}`)
      .then((res) => {
        console.log(`[Analytics] Pruned old events before ${pruneDate}`);
      })
      .catch((err) => {
        console.error("[Analytics] Pruning older events failed:", err);
      });
  }
}

/**
 * Tracks a game details page view.
 */
export async function trackGameView(gameId: string, title: string) {
  const today = getTodayDateString();
  const uuid = crypto.randomUUID();

  try {
    // 1. Upsert daily raw event count for this game
    await turso
      .insert(analyticsEvents)
      .values({
        id: uuid,
        type: "game_view",
        refId: gameId,
        refTitle: title,
        date: today,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [analyticsEvents.type, analyticsEvents.refId, analyticsEvents.date],
        set: {
          count: sql`${analyticsEvents.count} + 1`,
        },
      });

    // 2. Upsert daily aggregated total
    await turso
      .insert(analyticsDaily)
      .values({
        date: today,
        totalViews: 1,
        totalClicks: 0,
        totalSearches: 0,
      })
      .onConflictDoUpdate({
        target: [analyticsDaily.date],
        set: {
          totalViews: sql`${analyticsDaily.totalViews} + 1`,
        },
      });

    maybePruneOldEvents();
  } catch (err) {
    console.error("[Analytics] Failed to track game view:", err);
  }
}

/**
 * Tracks a purchase link click event.
 */
export async function trackLinkClick(gameId: string, storeName: string, refTitle: string) {
  const today = getTodayDateString();
  const uuid = crypto.randomUUID();

  try {
    // 1. Upsert daily raw event count for this store click
    await turso
      .insert(analyticsEvents)
      .values({
        id: uuid,
        type: "link_click",
        refId: `${gameId}:${storeName}`,
        refTitle: refTitle,
        date: today,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [analyticsEvents.type, analyticsEvents.refId, analyticsEvents.date],
        set: {
          count: sql`${analyticsEvents.count} + 1`,
        },
      });

    // 2. Upsert daily aggregated total
    await turso
      .insert(analyticsDaily)
      .values({
        date: today,
        totalViews: 0,
        totalClicks: 1,
        totalSearches: 0,
      })
      .onConflictDoUpdate({
        target: [analyticsDaily.date],
        set: {
          totalClicks: sql`${analyticsDaily.totalClicks} + 1`,
        },
      });

    maybePruneOldEvents();
  } catch (err) {
    console.error("[Analytics] Failed to track link click:", err);
  }
}

/**
 * Tracks a search query.
 */
export async function trackSearch(query: string) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return;
  
  const today = getTodayDateString();
  const uuid = crypto.randomUUID();

  try {
    // 1. Upsert daily raw event count for this search query
    await turso
      .insert(analyticsEvents)
      .values({
        id: uuid,
        type: "search",
        refId: cleanQuery,
        refTitle: query.trim(),
        date: today,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [analyticsEvents.type, analyticsEvents.refId, analyticsEvents.date],
        set: {
          count: sql`${analyticsEvents.count} + 1`,
        },
      });

    // 2. Upsert daily aggregated total
    await turso
      .insert(analyticsDaily)
      .values({
        date: today,
        totalViews: 0,
        totalClicks: 0,
        totalSearches: 1,
      })
      .onConflictDoUpdate({
        target: [analyticsDaily.date],
        set: {
          totalSearches: sql`${analyticsDaily.totalSearches} + 1`,
        },
      });

    maybePruneOldEvents();
  } catch (err) {
    console.error("[Analytics] Failed to track search query:", err);
  }
}
