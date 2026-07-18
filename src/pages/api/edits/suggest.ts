import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import { editSuggestions } from '../../../db/schema';
import { evaluateEditWithAI } from '../../../lib/aiModeration';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { gameId, field, oldValue, newValue, reason, userId } = body;

    if (!gameId || typeof gameId !== "string" || !gameId.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid gameId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!field || typeof field !== "string" || !field.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid field name" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (newValue === undefined || newValue === null || typeof newValue !== "string" || !newValue.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid new value" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const suggestionId = `edit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const trackingId = Math.floor(100000 + Math.random() * 900000).toString();

    // Run AI Pre-Moderation Shield
    const aiResult = await evaluateEditWithAI({
      field: field.trim(),
      oldValue: oldValue ? String(oldValue).trim() : null,
      newValue: newValue.trim(),
      reason: reason ? String(reason).trim() : null,
    });

    // Check user reputation for auto-approval qualification
    const { getUserReputation, LOW_RISK_FIELDS } = await import('../../../lib/userReputation');
    const userRep = await getUserReputation(userId);
    const isTrustedUser = userRep && (userRep.tier === 'tier_1_trusted' || userRep.tier === 'tier_2_moderator');
    const isLowRisk = LOW_RISK_FIELDS.has(field.trim());
    const isAutoApproved = isTrustedUser && isLowRisk && aiResult.aiStatus === 'passed';

    let finalStatus = aiResult.aiStatus === 'rejected' ? 'rejected' : 'pending';
    if (isAutoApproved) {
      finalStatus = 'auto_approved';
    }

    await turso.insert(editSuggestions).values({
      id: suggestionId,
      trackingId: trackingId,
      gameId: gameId.trim(),
      userId: typeof userId === "string" ? userId : null,
      userIp: clientIp,
      field: field.trim(),
      oldValue: oldValue ? String(oldValue).trim() : null,
      newValue: newValue.trim(),
      reason: reason ? String(reason).trim() : null,
      status: finalStatus,
      aiStatus: aiResult.aiStatus,
      aiConfidence: aiResult.aiConfidence,
      aiReasoning: aiResult.aiReasoning,
      reviewedBy: isAutoApproved ? 'system_auto_approval' : null,
      reviewedAt: isAutoApproved ? new Date() : null,
    });

    // If auto-approved, execute live update on games catalog immediately
    if (isAutoApproved) {
      try {
        const { games, gameRevisions } = await import('../../../db/schema');
        const { eq } = await import('drizzle-orm');

        await turso
          .update(games)
          .set({
            [field.trim()]: newValue.trim(),
            updatedAt: new Date(),
          })
          .where(eq(games.id, gameId.trim()));

        const revId = `rev_auto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await turso.insert(gameRevisions).values({
          id: revId,
          gameId: gameId.trim(),
          suggestionId: suggestionId,
          editedBy: userId || 'trusted_contributor',
          changesJson: JSON.stringify({
            field: field.trim(),
            oldValue: oldValue ? String(oldValue).trim() : null,
            newValue: newValue.trim(),
            reason: 'Auto-approved trusted edit',
          }),
        });
      } catch (autoErr) {
        console.warn('⚠️ Auto-approval live execution warning:', autoErr);
      }
    }

    // Dispatch Discord Webhook Notification
    try {
      const { sendDiscordEditNotification } = await import('../../../lib/discord');
      await sendDiscordEditNotification({
        title: isAutoApproved ? `⚡ Edit Auto-Published (#${trackingId})` : `📝 New Edit Suggestion (#${trackingId})`,
        description: isAutoApproved
          ? `A trusted contributor edited **${field.trim()}** and it was auto-published.`
          : `A new edit suggestion for **${field.trim()}** has been queued for review.`,
        color: isAutoApproved ? 0x8b5cf6 : (aiResult.aiStatus === 'flagged' ? 0xf59e0b : 0xef4444),
        fields: [
          { name: 'Game ID', value: gameId.trim(), inline: true },
          { name: 'Field', value: field.trim(), inline: true },
          { name: 'AI Rating', value: `🤖 ${aiResult.aiStatus} (${Math.round(aiResult.aiConfidence * 100)}%)`, inline: true },
          { name: 'Previous Value', value: oldValue ? `\`${oldValue}\`` : '*(Empty)*', inline: false },
          { name: 'Proposed Value', value: `\`${newValue.trim()}\``, inline: false },
          { name: 'Reason', value: reason ? `"${reason.trim()}"` : '*(None provided)*', inline: false },
        ],
        footerText: `Tracking Code: #${trackingId} • IP: ${clientIp}`,
      });
    } catch (discordErr) {
      console.warn('⚠️ Discord notification dispatch error:', discordErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: suggestionId,
        trackingId: trackingId,
        autoApproved: isAutoApproved,
        message: isAutoApproved
          ? "Edit auto-published! Your trusted status applied this change immediately."
          : "Edit suggestion submitted successfully and queued for moderation.",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error submitting edit suggestion:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg || "Failed to submit edit suggestion" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
