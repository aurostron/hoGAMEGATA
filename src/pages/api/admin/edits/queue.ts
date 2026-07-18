import type { APIRoute } from 'astro';
import { turso } from '../../../../lib/turso';
import { editSuggestions, games } from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const statusFilter = url.searchParams.get("status") || "pending";

    let query = turso
      .select({
        id: editSuggestions.id,
        trackingId: editSuggestions.trackingId,
        gameId: editSuggestions.gameId,
        gameTitle: games.title,
        gameSlug: games.slug,
        field: editSuggestions.field,
        oldValue: editSuggestions.oldValue,
        newValue: editSuggestions.newValue,
        reason: editSuggestions.reason,
        status: editSuggestions.status,
        aiStatus: editSuggestions.aiStatus,
        aiConfidence: editSuggestions.aiConfidence,
        aiReasoning: editSuggestions.aiReasoning,
        userIp: editSuggestions.userIp,
        createdAt: editSuggestions.createdAt,
      })
      .from(editSuggestions)
      .leftJoin(games, eq(editSuggestions.gameId, games.id));

    if (statusFilter !== "all") {
      query = query.where(eq(editSuggestions.status, statusFilter)) as any;
    }

    const rows = await query
      .orderBy(desc(editSuggestions.createdAt))
      .limit(100);

    return new Response(
      JSON.stringify({ suggestions: rows }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error fetching moderation queue:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch moderation queue" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
