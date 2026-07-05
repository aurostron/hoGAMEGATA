import type { APIRoute } from 'astro';
import { turso } from '../lib/turso';
import { games as gamesTable } from '../db/schema';
import { count } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
  try {
    const [countRow] = await turso
      .select({ total: count() })
      .from(gamesTable);

    const totalGames = countRow?.total || 0;
    if (totalGames === 0) {
      return redirect("/");
    }

    const randomIndex = Math.floor(Math.random() * totalGames);
    const [randomGame] = await turso
      .select({ slug: gamesTable.slug })
      .from(gamesTable)
      .limit(1)
      .offset(randomIndex);

    if (!randomGame?.slug) {
      return redirect("/");
    }

    return redirect(`/game/${randomGame.slug}`);
  } catch (error) {
    console.error("❌ Random redirect failed:", error);
    return redirect("/");
  }
};
