import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { turso } from '../../../../lib/turso';
import { games } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

let cfEnv: any = null;
try {
  const { env } = await import("cloudflare:workers");
  cfEnv = env;
} catch (e) {}

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Verify session and Admin rights
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const isAdmin = isAdminUser(user.email, cfEnv);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden. Admin access required." }), { status: 403 });
    }

    const body = await request.json();
    const { action, gameId, coverUrl, newUrl, urls, index } = body;

    if (!gameId) {
      return new Response(JSON.stringify({ error: "Game ID is required" }), { status: 400 });
    }

    // Fetch existing game
    const [game] = await turso
      .select({
        id: games.id,
        coverUrl: games.coverUrl,
        screenshots: games.screenshots,
      })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!game) {
      return new Response(JSON.stringify({ error: "Game not found" }), { status: 404 });
    }

    let existingScreenshots: string[] = [];
    if (game.screenshots) {
      try {
        existingScreenshots = JSON.parse(game.screenshots);
        if (!Array.isArray(existingScreenshots)) existingScreenshots = [];
      } catch (e) {
        existingScreenshots = [];
      }
    }

    // Handle actions
    if (action === "update-cover") {
      if (!coverUrl || typeof coverUrl !== "string") {
        return new Response(JSON.stringify({ error: "Invalid cover URL" }), { status: 400 });
      }
      await turso
        .update(games)
        .set({ coverUrl: coverUrl.trim(), updatedAt: new Date() })
        .where(eq(games.id, gameId));

      return new Response(JSON.stringify({ success: true, message: "Cover updated successfully" }), { status: 200 });
    }

    if (action === "delete-cover") {
      await turso
        .update(games)
        .set({ coverUrl: null, updatedAt: new Date() })
        .where(eq(games.id, gameId));

      return new Response(JSON.stringify({ success: true, message: "Cover removed" }), { status: 200 });
    }

    if (action === "add-screenshots") {
      if (!Array.isArray(urls) || urls.length === 0) {
        return new Response(JSON.stringify({ error: "No screenshot URLs provided" }), { status: 400 });
      }
      const updatedList = [...existingScreenshots, ...urls.map(u => u.trim()).filter(Boolean)];
      await turso
        .update(games)
        .set({ screenshots: JSON.stringify(updatedList), updatedAt: new Date() })
        .where(eq(games.id, gameId));

      return new Response(JSON.stringify({ success: true, screenshots: updatedList }), { status: 200 });
    }

    if (action === "replace-screenshot") {
      if (typeof index !== "number" || index < 0 || index >= existingScreenshots.length) {
        return new Response(JSON.stringify({ error: "Invalid screenshot index" }), { status: 400 });
      }
      if (!newUrl || typeof newUrl !== "string") {
        return new Response(JSON.stringify({ error: "Invalid replacement URL" }), { status: 400 });
      }
      existingScreenshots[index] = newUrl.trim();
      await turso
        .update(games)
        .set({ screenshots: JSON.stringify(existingScreenshots), updatedAt: new Date() })
        .where(eq(games.id, gameId));

      return new Response(JSON.stringify({ success: true, screenshots: existingScreenshots }), { status: 200 });
    }

    if (action === "delete-screenshot") {
      if (typeof index !== "number" || index < 0 || index >= existingScreenshots.length) {
        return new Response(JSON.stringify({ error: "Invalid screenshot index" }), { status: 400 });
      }
      existingScreenshots.splice(index, 1);
      await turso
        .update(games)
        .set({ screenshots: JSON.stringify(existingScreenshots), updatedAt: new Date() })
        .where(eq(games.id, gameId));

      return new Response(JSON.stringify({ success: true, screenshots: existingScreenshots }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  } catch (error) {
    console.error("❌ Media mutation API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
