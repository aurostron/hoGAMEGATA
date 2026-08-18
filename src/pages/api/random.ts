import type { APIRoute } from 'astro';
import { initTursoForRequest, libsqlClient } from '../../lib/turso';
import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async () => {
  const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);

  try {
    // Ultra-fast single-query B-Tree indexed random seek (<20ms)
    const randomSeed = Math.floor(Math.random() * 107800) + 1;
    const res = await libsqlClient.execute({
      sql: `SELECT slug, title, source FROM Game 
            WHERE rowid >= ? 
            AND (status IS NULL OR status != 'hidden') 
            LIMIT 1;`,
      args: [randomSeed]
    });

    let game = res.rows[0];

    // Fallback if randomSeed was near the very end
    if (!game || !game.slug) {
      const fallbackRes = await libsqlClient.execute({
        sql: `SELECT slug, title, source FROM Game 
              WHERE (status IS NULL OR status != 'hidden') 
              LIMIT 1;`,
        args: []
      });
      game = fallbackRes.rows[0];
    }

    if (!game || !game.slug) {
      return new Response(
        JSON.stringify({ slug: "silent-hill-2", title: "Silent Hill 2" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        slug: String(game.slug),
        title: String(game.title || "Unknown Nightmare")
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      }
    );
  } catch (error) {
    console.error("❌ Ultra-fast random fetch failed:", error);
    return new Response(
      JSON.stringify({ slug: "silent-hill-2", title: "Silent Hill 2" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      }
    );
  }
};
