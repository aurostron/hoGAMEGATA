import type { APIRoute } from 'astro';
import { turso } from '../../../../lib/turso';
import { games, gameRevisions } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.revisionId) {
      return new Response(
        JSON.stringify({ error: "Missing revisionId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { revisionId, reviewerId } = body;

    const [targetRevision] = await turso
      .select()
      .from(gameRevisions)
      .where(eq(gameRevisions.id, revisionId))
      .limit(1);

    if (!targetRevision) {
      return new Response(
        JSON.stringify({ error: "Revision record not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let changeData: { field?: string; oldValue?: string; newValue?: string } = {};
    try {
      changeData = JSON.parse(targetRevision.changesJson);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid revision payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!changeData.field) {
      return new Response(
        JSON.stringify({ error: "Revision does not specify a valid field" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetField = changeData.field;
    const restoredValue = changeData.oldValue || "";

    const [game] = await turso
      .select({ id: games.id, slug: games.slug })
      .from(games)
      .where(eq(games.id, targetRevision.gameId))
      .limit(1);

    if (!game) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Apply restored value to games table
    await turso
      .update(games)
      .set({
        [targetField]: restoredValue,
        updatedAt: new Date(),
      })
      .where(eq(games.id, targetRevision.gameId));

    // Log rollback revision
    const rollbackRevId = `rev_rollback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await turso.insert(gameRevisions).values({
      id: rollbackRevId,
      gameId: targetRevision.gameId,
      suggestionId: targetRevision.suggestionId,
      editedBy: reviewerId || "admin",
      changesJson: JSON.stringify({
        field: targetField,
        oldValue: changeData.newValue,
        newValue: restoredValue,
        reason: `Rollback to revision ${revisionId}`,
      }),
    });

    // Trigger Cloudflare Cache Purge for rolled back game
    try {
      const { purgeGameCache } = await import('../../../../lib/cloudflareCache');
      let cfEnv: any = null;
      try {
        const { env } = await import("cloudflare:workers");
        cfEnv = env;
      } catch (e) {}
      await purgeGameCache(game.slug, cfEnv);
    } catch (purgeErr) {
      console.warn('⚠️ Cache purge error:', purgeErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully rolled back ${targetField} on ${game.slug} and purged cache.`,
        rollbackRevId,
        purgeCacheTag: `game-${game.slug}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error executing rollback:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to execute rollback" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
