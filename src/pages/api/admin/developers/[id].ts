import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { turso } from '../../../../lib/turso';
import { developers, gamesToDevelopers, games } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

let cfEnv: any = null;
try {
  const { env } = await import("cloudflare:workers");
  cfEnv = env;
} catch (e) {}

export const prerender = false;

const checkAdmin = async (request: Request, cookies: any) => {
  const user = await getServerUser(request, cookies);
  return user ? isAdminUser(user.email, cfEnv) : false;
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    if (!await checkAdmin(request, cookies)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing developer ID" }), { status: 400 });
    }

    const { name } = await request.json();
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "Name is required" }), { status: 400 });
    }

    // 1. Update the developer's name on Developer table
    await turso
      .update(developers)
      .set({ name: name.trim() })
      .where(eq(developers.id, id));

    // 2. Fetch all games linked to this developer to synchronize their cached developerNames strings
    const linkedGames = await turso
      .select({ gameId: gamesToDevelopers.gameId })
      .from(gamesToDevelopers)
      .where(eq(gamesToDevelopers.developerId, id));

    // 3. For each linked game, re-fetch all its developers and update developerNames
    for (const link of linkedGames) {
      const allDevsForGame = await turso
        .select({ name: developers.name })
        .from(gamesToDevelopers)
        .innerJoin(developers, eq(gamesToDevelopers.developerId, developers.id))
        .where(eq(gamesToDevelopers.gameId, link.gameId));

      const joinedNames = allDevsForGame.map(d => d.name).join(", ");

      await turso
        .update(games)
        .set({ developerNames: joinedNames })
        .where(eq(games.id, link.gameId));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Failed to rename developer globally:", error);
    return new Response(JSON.stringify({ error: "Rename failed" }), { status: 500 });
  }
};
