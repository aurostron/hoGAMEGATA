import type { APIRoute } from 'astro';
import { FALLBACK_RANDOM_GAMES } from '../../data/randomPool';

export const prerender = false;

export const GET: APIRoute = async () => {
  // 0 Database queries, 0 Turso row reads, instant <1ms response
  const index = Math.floor(Math.random() * FALLBACK_RANDOM_GAMES.length);
  const game = FALLBACK_RANDOM_GAMES[index] || { slug: "silent-hill-2", title: "Silent Hill 2" };

  return new Response(
    JSON.stringify({
      slug: game.slug,
      title: game.title,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
};
