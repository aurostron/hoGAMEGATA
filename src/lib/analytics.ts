/**
 * Analytics — DISABLED for Turso free-tier survival (2026-09-09).
 *
 * Previously every game view / link click / search fired 2 Turso upserts
 * (AnalyticsEvent + AnalyticsDaily) plus a 2%-chance prune DELETE. At ~5k
 * views/day plus bot crawls across 107k game URLs, this burned a large share
 * of the 500M/month rows-read quota and contributed write load for zero
 * product value.
 *
 * All three trackers below are now intentional no-ops. Call sites were
 * removed; the stubs remain only so any leftover import never touches the DB.
 * If analytics returns, point it at Cloudflare Analytics Engine / KV beacons —
 * never at Turso rows.
 */

export async function trackGameView(_gameId: string, _title: string): Promise<void> {
  return;
}

export async function trackLinkClick(
  _gameId: string,
  _storeName: string,
  _refTitle: string
): Promise<void> {
  return;
}

export async function trackSearch(_query: string): Promise<void> {
  return;
}
