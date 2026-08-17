import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { turso } from '../../../../lib/turso';
import { games, gamesToDevelopers, developers, gamesToPlatforms, platforms } from '../../../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { syncCatboxAlbum } from '../../../../lib/catbox';
import { adminGamePatchSchema } from '../../../../lib/validations/adminSchemas';
import { logSecurityEvent } from '../../../../lib/auditLogger';
import { getClientIp } from '../../../../lib/rateLimit';

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
  const clientIp = getClientIp(request);
  try {
    if (!await checkAdmin(request, cookies)) {
      logSecurityEvent({
        eventType: "unauthorized_scope",
        severity: "high",
        clientIp,
        path: `/api/admin/games/${params.id || ""}`,
        method: "PATCH",
        details: { reason: "Non-admin attempted game edit" },
      });
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing game ID" }), { status: 400 });
    }

    const body = await request.json();
    const validation = adminGamePatchSchema.safeParse(body);
    if (!validation.success) {
      logSecurityEvent({
        eventType: "invalid_payload",
        severity: "low",
        clientIp,
        path: `/api/admin/games/${id}`,
        method: "PATCH",
        details: { errors: validation.error.flatten() },
      });
      return new Response(
        JSON.stringify({ error: "Validation failed", details: validation.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      title,
      status,
      releaseDate,
      coverUrl,
      trailerUrl,
      summary,
      storyline,
      scareRating,
      scareProfile,
      developerId,
      platformIds,
      screenshots,
      isTrending
    } = validation.data;

    const parsedReleaseDate = releaseDate ? new Date(releaseDate) : null;

    // 1. Run database operations in a single atomic transaction
    await turso.transaction(async (tx) => {
      // Update Game core metadata details
      await tx
        .update(games)
        .set({
          title: title.trim(),
          status: status || null,
          releaseDate: parsedReleaseDate,
          coverUrl: coverUrl || null,
          trailerUrl: trailerUrl || null,
          summary: summary || null,
          storyline: storyline || null,
          scareRating: scareRating !== undefined && scareRating !== null ? parseFloat(scareRating) : null,
          scareProfile: scareProfile ? JSON.stringify(scareProfile) : null,
          screenshots: screenshots ? JSON.stringify(screenshots) : null,
          isTrending: isTrending !== undefined ? isTrending === true : undefined,
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

      // Handle platform links updating
      if (platformIds !== undefined) {
        // Clear existing platform links
        await tx.delete(gamesToPlatforms).where(eq(gamesToPlatforms.gameId, id));

        if (platformIds && platformIds.length > 0) {
          // Insert new platform associations
          for (const platId of platformIds) {
            await tx.insert(gamesToPlatforms).values({
              gameId: id,
              platformId: platId
            });
          }

          // Fetch the platform names and update platformNames denormalized cached column
          const selectedPlats = await tx
            .select({ name: platforms.name })
            .from(platforms)
            .where(inArray(platforms.id, platformIds));

          const platNamesJoined = selectedPlats.map(p => p.name).join(", ");
          await tx
            .update(games)
            .set({ platformNames: platNamesJoined })
            .where(eq(games.id, id));
        } else {
          // Clear cached platform names
          await tx
            .update(games)
            .set({ platformNames: null })
            .where(eq(games.id, id));
        }
      }

      // Sync screenshots to Catbox album
      if (screenshots !== undefined) {
        const [dbGame] = await tx
          .select({ catboxAlbumId: games.catboxAlbumId, developerNames: games.developerNames })
          .from(games)
          .where(eq(games.id, id))
          .limit(1);

        if (dbGame) {
          const userhash = cfEnv?.CATBOX_USERHASH || 
            (typeof process !== "undefined" && process?.env ? process.env.CATBOX_USERHASH : undefined) ||
            "";

          await syncCatboxAlbum(
            tx,
            id,
            title.trim(),
            dbGame.developerNames,
            screenshots,
            dbGame.catboxAlbumId,
            userhash
          );
        }
      }
    });

    // 2. Trigger Cloudflare Edge Cache Purge for updated game
    try {
      const [updatedGame] = await turso
        .select({ slug: games.slug })
        .from(games)
        .where(eq(games.id, id))
        .limit(1);

      if (updatedGame?.slug) {
        const { purgeGameCache } = await import('../../../../lib/cloudflareCache');
        await purgeGameCache(updatedGame.slug, cfEnv);
      }
    } catch (purgeErr) {
      console.warn("⚠️ Cache purge trigger error:", purgeErr);
    }

    // 3. Trigger Cloudflare deploy webhook if configured to rebuild static pages
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
