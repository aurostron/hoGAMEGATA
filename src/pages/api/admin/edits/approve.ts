import type { APIRoute } from 'astro';
import { turso } from '../../../../lib/turso';
import { editSuggestions, games, gameRevisions } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export const prerender = false;

// Allowed fields that can be edited via community proposals
const ALLOWED_GAME_FIELDS: Record<string, string> = {
  developerNames: "developerNames",
  summary: "summary",
  storyline: "storyline",
  trailerUrl: "trailerUrl",
  coverUrl: "coverUrl",
  genreNames: "genreNames",
  platformNames: "platformNames",
  esrbRating: "esrbRating",
  pegiRating: "pegiRating",
  rating: "rating",
  metacritic: "metacritic",
  playtime: "playtime",
  protonDbTier: "protonDbTier",
  websiteUrl: "websiteUrl",
  redditUrl: "redditUrl",
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.suggestionId) {
      return new Response(
        JSON.stringify({ error: "Missing suggestionId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { suggestionId, reviewerId } = body;

    // Fetch suggestion and associated game in 1 single DB query (saving 1 DB read)
    const [row] = await turso
      .select({
        suggestion: editSuggestions,
        gameSlug: games.slug,
      })
      .from(editSuggestions)
      .leftJoin(games, eq(editSuggestions.gameId, games.id))
      .where(eq(editSuggestions.id, suggestionId))
      .limit(1);

    if (!row || !row.suggestion) {
      return new Response(
        JSON.stringify({ error: "Suggestion not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const suggestion = row.suggestion;
    const gameSlug = row.gameSlug || suggestion.gameId;

    if (suggestion.status !== "pending" && suggestion.status !== "auto_approved") {
      return new Response(
        JSON.stringify({ error: `Suggestion has already been ${suggestion.status}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetColumn = ALLOWED_GAME_FIELDS[suggestion.field];
    if (!targetColumn) {
      return new Response(
        JSON.stringify({ error: `Field '${suggestion.field}' is not editable.` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update target field on game record
    await turso
      .update(games)
      .set({
        [targetColumn]: suggestion.newValue,
        updatedAt: new Date(),
      })
      .where(eq(games.id, suggestion.gameId));

    // Relational Sync: If developerNames field is edited, auto-create Developer entities & links
    if (suggestion.field === "developerNames" && suggestion.newValue) {
      try {
        const { developers, gamesToDevelopers } = await import('../../../../db/schema');
        const devNames = suggestion.newValue.split(',').map((s: string) => s.trim()).filter(Boolean);

        for (const devName of devNames) {
          const devSlug = devName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          if (!devSlug) continue;

          // Find or create developer record
          let [existingDev] = await turso
            .select()
            .from(developers)
            .where(eq(developers.slug, devSlug))
            .limit(1);

          let devId = existingDev?.id;
          if (!existingDev) {
            devId = `dev_${devSlug}`;
            await turso.insert(developers).values({
              id: devId,
              name: devName,
              slug: devSlug,
            }).onConflictDoNothing();
          }

          if (devId) {
            // Link developer to game in join table
            await turso.insert(gamesToDevelopers).values({
              developerId: devId,
              gameId: suggestion.gameId,
            }).onConflictDoNothing();
          }
        }
      } catch (devSyncErr) {
        console.warn('⚠️ Warning: Developer entity relational sync error:', devSyncErr);
      }
    }

    // Record historical revision log
    const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await turso.insert(gameRevisions).values({
      id: revisionId,
      gameId: suggestion.gameId,
      suggestionId: suggestion.id,
      editedBy: reviewerId || suggestion.userId || "anonymous",
      changesJson: JSON.stringify({
        field: suggestion.field,
        oldValue: suggestion.oldValue,
        newValue: suggestion.newValue,
        reason: suggestion.reason,
      }),
    });

    // Update submitter's reputation score & check tier promotions
    if (suggestion.userId) {
      const { recordEditApproval } = await import('../../../../lib/userReputation');
      await recordEditApproval(suggestion.userId);
    }

    // Update suggestion record status
    await turso
      .update(editSuggestions)
      .set({
        status: "approved",
        reviewedBy: reviewerId || "admin",
        reviewedAt: new Date(),
      })
      .where(eq(editSuggestions.id, suggestionId));

    // Dispatch Discord Webhook Notification
    try {
      const { sendDiscordEditNotification } = await import('../../../../lib/discord');
      await sendDiscordEditNotification({
        title: `✅ Edit Proposal Approved (#${suggestion.trackingId || suggestionId})`,
        description: `Moderator **${reviewerId || 'Admin'}** approved the edit for **${gameSlug}**.`,
        color: 0x10b981, // Emerald Green
        fields: [
          { name: 'Game', value: gameSlug, inline: true },
          { name: 'Field', value: suggestion.field, inline: true },
          { name: 'Approved Value', value: `\`${suggestion.newValue}\``, inline: false },
        ],
        footerText: `Approved by ${reviewerId || 'Admin'}`,
      });
    } catch (discordErr) {
      console.warn('⚠️ Discord notification dispatch error:', discordErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Edit suggestion approved. Game ${gameSlug} updated.`,
        revisionId,
        purgeCacheTag: `game-${gameSlug}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error approving suggestion:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to approve suggestion" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
