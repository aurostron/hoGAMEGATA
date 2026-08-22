import type { APIRoute } from "astro";
import { turso, initTursoForRequest } from "../../../lib/turso";
import { games as gamesTable } from "../../../db/schema";
import { and, or, ne, like, sql, desc } from "drizzle-orm";
import { env as cfEnv } from "cloudflare:workers";
import { rateLimit, getClientIp, tooManyRequests } from "../../../lib/rateLimit";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`search_suggest:${clientIp}`, 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter, undefined, request);
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);

  try {
    const { searchParams } = new URL(request.url);
    const rawQ = searchParams.get("q")?.trim() || searchParams.get("search")?.trim() || "";

    if (!rawQ || rawQ.length === 0) {
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

    const cleanQuery = rawQ.toLowerCase().replace(/['"]/g, "");
    const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
    const prefixQuery = `${cleanQuery}%`;
    const substringQuery = `%${cleanQuery}%`;

    // Build conditions: match full substring or individual tokens
    const conditions = [
      like(gamesTable.title, substringQuery),
      like(gamesTable.developerNames, substringQuery),
    ];

    for (const term of terms) {
      if (term.length >= 2) {
        conditions.push(like(gamesTable.title, `%${term}%`));
        conditions.push(like(gamesTable.developerNames, `%${term}%`));
      }
    }

    // Build dynamic relevance scoring:
    // 1. Exact match: 1000 pts
    // 2. Starts with query: 500 pts
    // 3. Substring match in title: 300 pts
    // 4. Developer exact/prefix match: 200 pts
    // 5. Individual term matches: 50 pts each
    const firstTerm = terms[0] || cleanQuery;
    const firstTermPrefix = `${firstTerm}%`;

    const rows = await turso
      .select({
        id: gamesTable.id,
        title: gamesTable.title,
        slug: gamesTable.slug,
        coverUrl: gamesTable.coverUrl,
        developerNames: gamesTable.developerNames,
        isTrending: gamesTable.isTrending,
        rating: gamesTable.rating,
        popularity: gamesTable.popularity,
      })
      .from(gamesTable)
      .where(
        and(
          ne(gamesTable.status, "hidden"),
          or(...conditions)
        )
      )
      .orderBy(
        sql`CASE 
          WHEN LOWER(${gamesTable.title}) = ${cleanQuery} THEN 1000
          WHEN LOWER(${gamesTable.title}) LIKE ${prefixQuery} THEN 500
          WHEN LOWER(${gamesTable.title}) LIKE ${substringQuery} THEN 300
          WHEN LOWER(${gamesTable.title}) LIKE ${firstTermPrefix} THEN 200
          WHEN LOWER(${gamesTable.developerNames}) LIKE ${substringQuery} THEN 150
          ELSE 50
        END DESC`,
        desc(gamesTable.isTrending),
        desc(gamesTable.rating),
        desc(gamesTable.popularity)
      )
      .limit(10);

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
