import type { APIRoute } from 'astro';
import { initTursoForRequest, libsqlClient } from '../lib/turso';
import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
  const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);

  try {
    const randomSeed = Math.floor(Math.random() * 107800) + 1;
    const res = await libsqlClient.execute({
      sql: `SELECT slug FROM Game 
            WHERE rowid >= ? 
            AND (status IS NULL OR status != 'hidden') 
            LIMIT 1;`,
      args: [randomSeed]
    });

    let game = res.rows[0];

    if (!game || !game.slug) {
      const fallbackRes = await libsqlClient.execute({
        sql: `SELECT slug FROM Game 
              WHERE (status IS NULL OR status != 'hidden') 
              LIMIT 1;`,
        args: []
      });
      game = fallbackRes.rows[0];
    }

    if (!game?.slug) {
      return redirect("/game/silent-hill-2");
    }

    return redirect(`/game/${game.slug}`);
  } catch (error) {
    console.error("❌ Random redirect failed:", error);
    return redirect("/games");
  }
};
