import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../../lib/serverAuth';
import { turso } from '../../../../lib/turso';
import { games, gamesToDevelopers, developers, gamesToPlatforms, platforms } from '../../../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { syncCatboxAlbum } from '../../../../lib/catbox';

let cfEnv: any = null;
try {
  const { env } = await import("cloudflare:workers");
  cfEnv = env;
} catch (e) {}

export const prerender = false;

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');         // Replace multiple - with single -
}

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

    // 2. Parse request body
    const body = await request.json();
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
    } = body;

    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: "Title is required" }), { status: 400 });
    }

    const newId = crypto.randomUUID();
    let slug = slugify(title);

    // 3. Run creations in an atomic database transaction
    await turso.transaction(async (tx) => {
      // Ensure slug uniqueness
      const [existingSlug] = await tx
        .select({ id: games.id })
        .from(games)
        .where(eq(games.slug, slug))
        .limit(1);

      if (existingSlug) {
        slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
      }

      // Handle developer cache values
      let devNames: string | null = null;
      if (developerId) {
        const [dev] = await tx
          .select({ name: developers.name })
          .from(developers)
          .where(eq(developers.id, developerId))
          .limit(1);
        if (dev) {
          devNames = dev.name;
        }
      }

      // Handle platform cache values
      let platNamesJoined: string | null = null;
      if (platformIds && platformIds.length > 0) {
        const selectedPlats = await tx
          .select({ name: platforms.name })
          .from(platforms)
          .where(inArray(platforms.id, platformIds));
        platNamesJoined = selectedPlats.map(p => p.name).join(", ");
      }

      // Format dates
      const parsedReleaseDate = releaseDate ? new Date(releaseDate) : null;

      // Insert new game record
      await tx.insert(games).values({
        id: newId,
        title: title.trim(),
        slug: slug,
        status: status || 'released',
        releaseDate: parsedReleaseDate,
        coverUrl: coverUrl || null,
        trailerUrl: trailerUrl || null,
        screenshots: screenshots ? JSON.stringify(screenshots) : null,
        summary: summary || null,
        storyline: storyline || null,
        scareRating: scareRating !== undefined ? parseFloat(scareRating) : null,
        scareProfile: scareProfile ? JSON.stringify(scareProfile) : null,
        developerNames: devNames,
        platformNames: platNamesJoined,
        isTrending: isTrending === true,
        rawgEnriched: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Insert developer association
      if (developerId) {
        await tx.insert(gamesToDevelopers).values({
          developerId: developerId,
          gameId: newId
        });
      }

      // Insert platform associations
      if (platformIds && platformIds.length > 0) {
        for (const platId of platformIds) {
          await tx.insert(gamesToPlatforms).values({
            gameId: newId,
            platformId: platId
          });
        }
      }

      // Sync screenshots to Catbox album
      const userhash = cfEnv?.CATBOX_USERHASH || 
        (typeof process !== "undefined" && process?.env ? process.env.CATBOX_USERHASH : undefined) ||
        "";
      
      if (screenshots && screenshots.length > 0) {
        await syncCatboxAlbum(
          tx,
          newId,
          title.trim(),
          devNames,
          screenshots,
          null,
          userhash
        );
      }
    });

    // 4. Trigger Cloudflare deploy webhook if configured to rebuild static pages
    if (cfEnv?.CLOUDFLARE_DEPLOY_WEBHOOK) {
      console.log("Triggering Cloudflare rebuild via deploy webhook...");
      try {
        await fetch(cfEnv.CLOUDFLARE_DEPLOY_WEBHOOK, { method: "POST" });
      } catch (e) {
        console.error("Webhook trigger failed:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, id: newId, slug }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Failed to create game:", error);
    return new Response(JSON.stringify({ error: "Failed to create game" }), { status: 500 });
  }
};
