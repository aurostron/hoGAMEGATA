import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import { editSuggestions } from '../../../db/schema';
import { evaluateEditWithAI } from '../../../lib/aiModeration';
import { getServerUser } from '../../../lib/serverAuth';
import { rateLimit, getClientIp, tooManyRequests } from '../../../lib/rateLimit';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { gameId, field, oldValue, newValue, reason, userId: bodyUserId, turnstileToken } = body;

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

    if (!turnstileToken || typeof turnstileToken !== "string") {
      return new Response(
        JSON.stringify({ error: "CAPTCHA verification required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const clientIp = getClientIp(request);
    const rl = await rateLimit(`edits:${clientIp}`, 5, 600);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter, 'Too many edit suggestions. Please try again later.');

    let cfEnv: any = {};
    try {
      const cf = await import('cloudflare:workers');
      cfEnv = cf.env || {};
    } catch {}

    const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
    const runtimeEnv = {
      ...(typeof process !== 'undefined' && process.env ? process.env : {}),
      ...(cfEnv || {}),
    };
    const turnstileSecret = (runtimeEnv as any).TURNSTILE_SECRET_KEY || (isDev ? '1x0000000000000000000000000000000AA' : undefined);

    if (isDev && (turnstileToken === 'XXXX.DUMMY.TOKEN.XXXX' || turnstileToken.startsWith('XXXX.') || !turnstileSecret || turnstileSecret === '1x0000000000000000000000000000000AA')) {
      // Auto-pass Turnstile in development mode
    } else if (turnstileSecret) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
            remoteip: clientIp,
          }),
          signal: controller.signal,
        }).catch((err) => {
          console.warn('[Turnstile] Siteverify fetch failed:', err?.message || err);
          return null;
        });
        clearTimeout(timeoutId);

        if (verifyRes) {
          const verifyData = await verifyRes.json().catch(() => null) as { success?: boolean } | null;
          if (verifyData && verifyData.success === false && !isDev) {
            return new Response(
              JSON.stringify({ error: 'CAPTCHA verification failed. Please try again.' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (err) {
        console.warn('[Turnstile] Verification request warning (allowing dev fallback):', err);
      }
    }

    // Verify userId server-side — never trust client-supplied userId for reputation lookups
    const sessionUser = await getServerUser(request, cookies);
    const verifiedUserId = sessionUser?.id || null;
    const suggestionId = `edit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const trackingId = Math.floor(100000 + Math.random() * 900000).toString();

    // Resolve target game ID (supports both game.id and game.slug)
    const { games } = await import('../../../db/schema');
    const { eq, or } = await import('drizzle-orm');
    const [targetGame] = await turso
      .select({ id: games.id })
      .from(games)
      .where(or(eq(games.id, gameId.trim()), eq(games.slug, gameId.trim())))
      .limit(1);

    const resolvedGameId = targetGame?.id || gameId.trim();

    // Run AI Pre-Moderation Shield
    const aiResult = await evaluateEditWithAI({
      field: field.trim(),
      oldValue: oldValue ? String(oldValue).trim() : null,
      newValue: newValue.trim(),
      reason: reason ? String(reason).trim() : null,
    });

    // Check user reputation for auto-approval qualification
    const { getUserReputation, LOW_RISK_FIELDS } = await import('../../../lib/userReputation');
    const userRep = await getUserReputation(verifiedUserId);
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
      gameId: resolvedGameId,
      userId: typeof verifiedUserId === "string" ? verifiedUserId : null,
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
          editedBy: verifiedUserId || 'trusted_contributor',
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
