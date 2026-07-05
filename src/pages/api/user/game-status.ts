import type { APIRoute } from 'astro';
import { getServerUser } from '../../../lib/serverAuth';
import { tursoAuth } from '../../../lib/tursoAuth';
import { wishlist as wishlistTable, collection as collectionTable } from '../../../db/auth-schema';
import { eq, and } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ loggedIn: false }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    // Query separate Auth Database for wishlist & collection status
    const [wishlistItem, collectionItem] = await Promise.all([
      tursoAuth
        .select({ id: wishlistTable.id })
        .from(wishlistTable)
        .where(
          and(
            eq(wishlistTable.userId, user.id),
            eq(wishlistTable.gameId, gameId)
          )
        )
        .limit(1),
      tursoAuth
        .select({ status: collectionTable.status })
        .from(collectionTable)
        .where(
          and(
            eq(collectionTable.userId, user.id),
            eq(collectionTable.gameId, gameId)
          )
        )
        .limit(1)
    ]);

    return new Response(
      JSON.stringify({
        loggedIn: true,
        wishlisted: wishlistItem.length > 0,
        collectionStatus: collectionItem[0]?.status || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Failed to resolve user status for game:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
