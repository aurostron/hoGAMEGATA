import { getSupabaseServer } from "./supabaseServer";

// ============================================================
// Typed RPC wrappers for Supabase PostgreSQL functions
// Each function maps to a SQL function in scripts/sql/rpc_functions.sql
// ============================================================

export interface SearchResult {
  id: string;
}

export interface PriceSnapshot {
  gameId: string;
  storeName: string;
  dealPrice: number;
  retailPrice: number;
  discountPercent: number;
  dealUrl: string;
  currency: string;
  country: string;
}

export interface DbStats {
  games: number;
  developers: number;
  publishers: number;
  tags: number;
  screenshots: number;
  waitlist: number;
}

// --- FTS Search ---

export async function searchGamesExact(query: string, limit = 100): Promise<SearchResult[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("search_games_exact", {
    search_query: query,
    result_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

export async function searchGamesSemantic(
  cleanedQuery: string,
  expandedQuery: string,
  limit = 100
): Promise<SearchResult[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("search_games_semantic", {
    cleaned_query: cleanedQuery,
    expanded_query: expandedQuery,
    result_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

export async function randomGameIds(tagSlugs: string[] | null, limit = 20): Promise<SearchResult[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("random_games", {
    tag_slugs: tagSlugs,
    result_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

// --- Price Snapshots ---

export async function getCheapestSnapshots(gameIds: string[]): Promise<PriceSnapshot[]> {
  if (gameIds.length === 0) return [];
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("get_cheapest_snapshots", {
    game_ids: gameIds,
  });
  if (error) throw error;
  return data || [];
}

// --- Database Stats ---

export async function getDbStats(): Promise<DbStats | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("get_db_stats");
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0];
  return {
    games: Number(row.games),
    developers: Number(row.developers),
    publishers: Number(row.publishers),
    tags: Number(row.tags),
    screenshots: Number(row.screenshots),
    waitlist: Number(row.waitlist),
  };
}

// --- Random Game ---

export async function randomGameSlug(): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("random_game_slug");
  if (error) throw error;
  return data || null;
}

// --- Health Check ---

export async function healthCheck(): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("health_check");
  return !error;
}

// --- User Upsert ---

export async function upsertUserSafe(
  userId: string,
  email: string,
  maxUsers = 10000
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("upsert_user_safe", {
    user_id: userId,
    user_email: email,
    max_users: maxUsers,
  });
  if (error) throw error;
  return data || { success: false, error: "Unknown error" };
}
