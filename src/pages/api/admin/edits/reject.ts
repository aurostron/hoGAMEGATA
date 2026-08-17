import type { APIRoute } from 'astro';
import { turso } from '../../../../lib/turso';
import { editSuggestions } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { logSecurityEvent } from '../../../../lib/auditLogger';
import { getClientIp, forbiddenResponse } from '../../../../lib/rateLimit';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const clientIp = getClientIp(request);
  const user = await getServerUser(request, cookies);
  if (!user || !isAdminUser(user.email)) {
    logSecurityEvent({
      eventType: "unauthorized_scope",
      severity: "high",
      clientIp,
      path: "/api/admin/edits/reject",
      method: "POST",
      details: { reason: "Unauthorized attempt to reject edit suggestion" },
    });
    return forbiddenResponse("Forbidden: Admin access required.");
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.suggestionId) {
      return new Response(
        JSON.stringify({ error: "Missing suggestionId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { suggestionId } = body;
    const reviewerId = user.email;

    const [suggestion] = await turso
      .select({ userId: editSuggestions.userId })
      .from(editSuggestions)
      .where(eq(editSuggestions.id, suggestionId))
      .limit(1);

    await turso
      .update(editSuggestions)
      .set({
        status: "rejected",
        reviewedBy: reviewerId || "admin",
        reviewedAt: new Date(),
      })
      .where(eq(editSuggestions.id, suggestionId));

    if (suggestion?.userId) {
      const { recordEditRejection } = await import('../../../../lib/userReputation');
      await recordEditRejection(suggestion.userId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Edit suggestion rejected.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error rejecting suggestion:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to reject suggestion" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
