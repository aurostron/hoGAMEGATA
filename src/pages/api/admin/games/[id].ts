import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { turso } from '../../../../lib/turso';
import { games, gamesToDevelopers, developers } from '../../../../db/schema';
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
      return new Response(JSON.stringify({ error: "Missing game ID" }), { status: 400 });
    }

    const { title, status, developerId } = await request.json();

    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: "Title is required" }), { status: 400 });
    }

    // 1. Run database operations in a single atomic transaction
    await turso.transaction(async (tx) => {
      // Update Game core details
      await tx
        .update(games)
        .set({
          title: title.trim(),
          status: status || null,
          updatedAt: new Date()
        })
        .where(eq(games.id, id));

      // Handle developer link updating
      if (developerId !== undefined) {
        // Clear existing developer link
        await tx.delete(gamesToDevelopers).where(eq(gamesToDevelopers.gameId, id));

        if (developerId) {
          // Link new developer
          await tx.insert(gamesToDevelopers).values({
            developerId: developerId,
            gameId: id
          });

          // Fetch the new developer's name to update the cached string
          const [dev] = await tx
            .select({ name: developers.name })
            .from(developers)
            .where(eq(developers.id, developerId))
            .limit(1);

          if (dev) {
            await tx
              .update(games)
              .set({ developerNames: dev.name })
              .where(eq(games.id, id));
          }
        } else {
          // Clear cached developer names
          await tx
            .update(games)
            .set({ developerNames: null })
            .where(eq(games.id, id));
        }
      }
    });

    // 2. Trigger Cloudflare deploy webhook if configured to rebuild static pages
    if (cfEnv?.CLOUDFLARE_DEPLOY_WEBHOOK) {
      console.log("Triggering Cloudflare rebuild via deploy webhook...");
      try {
        await fetch(cfEnv.CLOUDFLARE_DEPLOY_WEBHOOK, { method: "POST" });
      } catch (e) {
        console.error("Webhook trigger failed:", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Failed to update game metadata:", error);
    return new Response(JSON.stringify({ error: "Update failed" }), { status: 500 });
  }
};
