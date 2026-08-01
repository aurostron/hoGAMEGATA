import type { APIRoute } from "astro";
import { turso, initTursoForRequest } from "../../../lib/turso";
import { games as gamesTable } from "../../../db/schema";
import { and, or, ne, like, sql, desc } from "drizzle-orm";
import { env as cfEnv } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || searchParams.get("search")?.trim() || "";

    if (!q || q.length === 0) {
      return new Response(
        JSON.stringify({ games: [] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          },
        }
      );
    }

    const cleanQuery = q.toLowerCase();
    const prefixQuery = `${cleanQuery}%`;
    const substringQuery = `%${cleanQuery}%`;

    const rows = await turso
      .select({
        id: gamesTable.id,
        title: gamesTable.title,
        slug: gamesTable.slug,
        coverUrl: gamesTable.coverUrl,
        developerNames: gamesTable.developerNames,
        isTrending: gamesTable.isTrending,
      })
      .from(gamesTable)
      .where(
        and(
          ne(gamesTable.status, "hidden"),
          or(
            like(gamesTable.title, substringQuery),
            like(gamesTable.developerNames, substringQuery)
          )
        )
      )
      .orderBy(
        sql`CASE 
          WHEN LOWER(${gamesTable.title}) = ${cleanQuery} THEN 0
          WHEN LOWER(${gamesTable.title}) LIKE ${prefixQuery} THEN 1
          WHEN LOWER(${gamesTable.title}) LIKE ${substringQuery} THEN 2
          ELSE 3
        END ASC`,
        desc(gamesTable.isTrending),
        desc(gamesTable.popularity)
      )
      .limit(6);

    return new Response(
      JSON.stringify({ games: rows }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Search suggest API error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ games: [], error: "Failed to fetch suggestions" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
