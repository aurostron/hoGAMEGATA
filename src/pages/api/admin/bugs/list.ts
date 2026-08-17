import type { APIRoute } from 'astro';
import { turso } from '../../../../lib/turso';
import { bugReports } from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { logSecurityEvent } from '../../../../lib/auditLogger';
import { getClientIp, forbiddenResponse } from '../../../../lib/rateLimit';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const clientIp = getClientIp(request);
  const user = await getServerUser(request, cookies);
  if (!user || !isAdminUser(user.email)) {
    logSecurityEvent({
      eventType: "unauthorized_scope",
      severity: "high",
      clientIp,
      path: "/api/admin/bugs/list",
      method: "GET",
      details: { reason: "Unauthorized attempt to list bug reports" },
    });
    return forbiddenResponse("Forbidden: Admin access required.");
  }

  try {
    const statusFilter = url.searchParams.get("status") || "new";

    let query = turso
      .select({
        id: bugReports.id,
        ticketId: bugReports.ticketId,
        category: bugReports.category,
        severity: bugReports.severity,
        title: bugReports.title,
        description: bugReports.description,
        pageUrl: bugReports.pageUrl,
        contactEmail: bugReports.contactEmail,
        status: bugReports.status,
        adminNotes: bugReports.adminNotes,
        createdAt: bugReports.createdAt,
      })
      .from(bugReports);

    if (statusFilter !== "all") {
      query = query.where(eq(bugReports.status, statusFilter)) as any;
    }

    const rows = await query
      .orderBy(desc(bugReports.createdAt))
      .limit(100);

    return new Response(
      JSON.stringify({ reports: rows }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error fetching bug reports:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch bug reports" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
