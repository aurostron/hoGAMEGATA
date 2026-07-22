import type { APIRoute } from 'astro';

export const prerender = false;

import { verifyKey } from 'discord-interactions';

export const GET: APIRoute = async () => {
  return new Response('hoGAMEGATA Discord Interactions Endpoint Ready', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const rawBody = await request.text();

    const env = (locals as any)?.runtime?.env || (typeof process !== 'undefined' ? process.env : {});
    const publicKey = env.DISCORD_PUBLIC_KEY || (typeof process !== 'undefined' ? process.env?.DISCORD_PUBLIC_KEY : undefined);

    // Verify signature if DISCORD_PUBLIC_KEY is configured
    if (publicKey) {
      if (!signature || !timestamp) {
        return new Response('Missing Discord signature headers', { status: 401 });
      }
      const isValid = verifyKey(rawBody, signature, timestamp, publicKey);
      if (!isValid) {
        return new Response('Invalid request signature', { status: 401 });
      }
    } else {
      console.warn("⚠️ DISCORD_PUBLIC_KEY is not set in environment variables. Signature verification skipped.");
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // TYPE 1: Discord Interaction Validation PING from Developer Portal
    if (payload.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TYPE 3: Button Click Interaction Event
    if (payload.type === 3) {
      const customId = payload.data?.custom_id || '';
      const user = payload.member?.user?.username || payload.user?.username || 'Discord Admin';

      if (customId.startsWith('approve_edit_')) {
        const suggestionId = customId.replace('approve_edit_', '');
        try {
          const { turso } = await import('../../../lib/turso');
          const { editSuggestions, games } = await import('../../../db/schema');
          const { eq } = await import('drizzle-orm');

          const [row] = await turso
            .select({ suggestion: editSuggestions, gameSlug: games.slug })
            .from(editSuggestions)
            .leftJoin(games, eq(editSuggestions.gameId, games.id))
            .where(eq(editSuggestions.id, suggestionId))
            .limit(1);

          if (row && row.suggestion) {
            const ALLOWED_GAME_FIELDS: Record<string, string> = {
              developerNames: "developerNames",
              summary: "summary",
              storyline: "storyline",
              trailerUrl: "trailerUrl",
              coverUrl: "coverUrl",
              genreNames: "genreNames",
              platformNames: "platformNames",
              esrbRating: "esrbRating",
              websiteUrl: "websiteUrl",
              redditUrl: "redditUrl",
            };

            const targetColumn = ALLOWED_GAME_FIELDS[row.suggestion.field];
            if (targetColumn) {
              await turso
                .update(games)
                .set({ [targetColumn]: row.suggestion.newValue, updatedAt: new Date() })
                .where(eq(games.id, row.suggestion.gameId));
            }

            await turso
              .update(editSuggestions)
              .set({ status: 'approved', reviewedBy: `Discord: ${user}`, reviewedAt: new Date() })
              .where(eq(editSuggestions.id, suggestionId));

            if (row.suggestion.userId) {
              const { recordEditApproval } = await import('../../../lib/userReputation');
              await recordEditApproval(row.suggestion.userId);
            }
          }
        } catch (err) {
          console.error("Failed to approve suggestion from Discord interaction:", err);
        }

        // Return update payload to Discord: Type 7 (Update Message)
        return new Response(
          JSON.stringify({
            type: 7,
            data: {
              content: `✅ **Approved by ${user}** via Discord 1-Click Action.`,
              components: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (customId.startsWith('reject_edit_')) {
        const suggestionId = customId.replace('reject_edit_', '');
        try {
          const { turso } = await import('../../../lib/turso');
          const { editSuggestions } = await import('../../../db/schema');
          const { eq } = await import('drizzle-orm');

          await turso
            .update(editSuggestions)
            .set({ status: 'rejected', reviewedBy: `Discord: ${user}`, reviewedAt: new Date() })
            .where(eq(editSuggestions.id, suggestionId));
        } catch (err) {
          console.error("Failed to reject suggestion from Discord interaction:", err);
        }

        return new Response(
          JSON.stringify({
            type: 7,
            data: {
              content: `❌ **Rejected by ${user}** via Discord 1-Click Action.`,
              components: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(JSON.stringify({ type: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Discord interaction error:', err);
    return new Response('Server Error', { status: 500 });
  }
};
