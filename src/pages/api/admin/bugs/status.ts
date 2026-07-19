import type { APIRoute } from 'astro';
import { turso } from '../../../../lib/turso';
import { bugReports } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.reportId || !body.status) {
      return new Response(
        JSON.stringify({ error: "Missing reportId or status" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { reportId, status, adminNotes } = body;
    const validStatuses = ['new', 'in_progress', 'resolved', 'dismissed'];

    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await turso
      .update(bugReports)
      .set({
        status,
        adminNotes: adminNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, reportId));

    return new Response(
      JSON.stringify({ success: true, message: `Bug report status updated to ${status}` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error updating bug report status:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to update bug report status" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
