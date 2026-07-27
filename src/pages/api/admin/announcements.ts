import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import { announcements } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getServerUser, isAdminUser } from '../../../lib/serverAuth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getServerUser(request);
    if (!user || !isAdminUser(user)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.title || !body.summary) {
      return new Response(
        JSON.stringify({ error: "Title and Summary are required fields." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { title, summary, version, category, date, linkUrl, isPublished } = body;
    const announcementId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const parsedDate = date ? new Date(date) : new Date();

    await turso.insert(announcements).values({
      id: announcementId,
      title: title.trim(),
      summary: summary.trim(),
      version: version ? version.trim() : null,
      category: category ? category.trim() : 'changelog',
      date: parsedDate,
      linkUrl: linkUrl ? linkUrl.trim() : null,
      isPublished: isPublished !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return new Response(
      JSON.stringify({ success: true, id: announcementId, message: "Announcement published successfully!" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating announcement:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to create announcement" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const user = await getServerUser(request);
    if (!user || !isAdminUser(user)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.id || !body.title || !body.summary) {
      return new Response(
        JSON.stringify({ error: "ID, Title, and Summary are required fields." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { id, title, summary, version, category, date, linkUrl, isPublished } = body;
    const parsedDate = date ? new Date(date) : new Date();

    await turso
      .update(announcements)
      .set({
        title: title.trim(),
        summary: summary.trim(),
        version: version ? version.trim() : null,
        category: category ? category.trim() : 'changelog',
        date: parsedDate,
        linkUrl: linkUrl ? linkUrl.trim() : null,
        isPublished: isPublished !== false,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id));

    return new Response(
      JSON.stringify({ success: true, message: "Announcement updated successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating announcement:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to update announcement" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, url }) => {
  try {
    const user = await getServerUser(request);
    if (!user || !isAdminUser(user)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing announcement ID parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await turso.delete(announcements).where(eq(announcements.id, id));

    return new Response(
      JSON.stringify({ success: true, message: "Announcement deleted successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to delete announcement" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
