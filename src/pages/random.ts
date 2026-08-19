import type { APIRoute } from 'astro';
import { FALLBACK_RANDOM_GAMES } from '../data/randomPool';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
  // 0 Database queries, 0 Turso row reads, instant <1ms redirect
  const index = Math.floor(Math.random() * FALLBACK_RANDOM_GAMES.length);
  const game = FALLBACK_RANDOM_GAMES[index] || { slug: "silent-hill-2" };

  return redirect(`/game/${game.slug}`, 302);
};
