import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const rawgSlug = url.searchParams.get("rawgSlug");
  const title = url.searchParams.get("title");

  const apiKey = import.meta.env.RAWG_API_KEY || process.env.RAWG_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ team: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  const parseTeam = (results: any[]) => {
    return results.map((item: any) => {
      const positions = item.positions?.map((p: any) => p.name) || [];
      const primaryRole = positions[0] || "Contributor";
      return {
        id: item.id,
        name: item.name,
        role: primaryRole,
        roles: positions,
        image: item.image || null,
        rawgSlug: item.slug
      };
    });
  };

  try {
    let targetSlug = rawgSlug;

    // Direct slug fetch if available
    if (targetSlug) {
      const teamUrl = `https://api.rawg.io/api/games/${targetSlug}/development-team?key=${apiKey}`;
      const res = await fetch(teamUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return new Response(JSON.stringify({ team: parseTeam(data.results) }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=86400, s-maxage=86400"
            }
          });
        }
      }
    }

    // Fallback: search RAWG by title
    if (title) {
      const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
      const searchRes = await fetch(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const bestMatch = searchData.results?.[0];
        if (bestMatch && bestMatch.slug) {
          const teamUrl = `https://api.rawg.io/api/games/${bestMatch.slug}/development-team?key=${apiKey}`;
          const teamRes = await fetch(teamUrl);
          if (teamRes.ok) {
            const teamData = await teamRes.json();
            if (teamData.results && teamData.results.length > 0) {
              return new Response(JSON.stringify({ team: parseTeam(teamData.results) }), {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=86400, s-maxage=86400"
                }
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ team: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching game credits from RAWG:", error);
    return new Response(JSON.stringify({ team: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};
