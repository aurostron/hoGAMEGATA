import { env as cfEnv } from "cloudflare:workers";

/**
 * Itch enrichment queue — zero-Turso-write request path (2026-09-09).
 *
 * When an unenriched itch game page is viewed, the SSR route renders it
 * display-only from the existing DB row + a live itch.io data.json fetch and
 * calls queueItchEnrichment() instead of UPDATE/INSERT against Turso.
 *
 * Storage: Cloudflare KV (MAINTENANCE preferred, RATE_LIMIT fallback) under
 * ENRICH_QUEUE_KEY as a JSON string array of game slugs (stable keys; the
 * weekly batch resolves ids from slugs). Capped at MAX_QUEUE entries.
 *
 * Consumer contract for the weekly batch Action (project-hgg.github.io):
 * - Read: KV GET <ENRICH_QUEUE_KEY> (or `wrangler kv:key get`), parse slugs.
 * - Discovery fallback (0 Turso reads): parse catalog-dump.json.gz for games
 *   with missing cover/summary (rawgEnriched=false) — the queue is only a
 *   recently-viewed priority hint, never the sole source.
 * - Enrich in chunks of <=200 statements per batch(..., "write"), off-peak.
 * - After a successful batch, KV PUT the remaining slugs (or delete the key).
 *
 * KV free-tier note: 1k writes/day. queueItchEnrichment dedupes via a KV read
 * first (reads: 100k/day, cheap) plus an isolate-local memory set, so repeat
 * views of the same slug cost 0 KV writes. Overflow is safe: worst case the
 * slug is discovered via the dump fallback instead. All failures are silent.
 */

export const ENRICH_QUEUE_KEY = "itch_enrich_queue_v1";
export const MAX_QUEUE = 5000;

const g = globalThis as any;
if (!g.__enrichQueueSeen) {
  g.__enrichQueueSeen = new Set<string>();
}
const seenSlugs: Set<string> = g.__enrichQueueSeen;

function getQueueKv(): any | null {
  try {
    const runtimeEnv = (cfEnv as any) || {};
    return runtimeEnv?.MAINTENANCE || runtimeEnv?.RATE_LIMIT || null;
  } catch {
    return null;
  }
}

/**
 * Best-effort enqueue of an unenriched itch game slug. Never throws, never
 * touches Turso. Safe to call on every view (deduped).
 */
export async function queueItchEnrichment(slug: string): Promise<void> {
  if (!slug) return;
  try {
    if (seenSlugs.has(slug)) return;
    seenSlugs.add(slug);

    const kv = getQueueKv();
    if (!kv) return; // local dev / no KV binding: isolate-local memory only

    let arr: string[] = [];
    try {
      const raw = await kv.get(ENRICH_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed.filter((s) => typeof s === "string");
      }
    } catch {
      arr = [];
    }

    if (arr.includes(slug)) return;
    arr.push(slug);
    if (arr.length > MAX_QUEUE) arr = arr.slice(arr.length - MAX_QUEUE);

    try {
      await kv.put(ENRICH_QUEUE_KEY, JSON.stringify(arr));
    } catch {
      // KV write quota exceeded or unavailable — safe to drop; the weekly
      // dump-diff fallback will still discover this slug.
    }
  } catch {
    // Never break page rendering for queue bookkeeping.
  }
}
