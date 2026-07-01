import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../lib/supabaseServer';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const supabase = getSupabaseServer();
    
    // Fetch all game slugs and updatedAt timestamps
    const { data: games, error } = await supabase
      .from("Game")
      .select("slug, updatedAt")
      .order("updatedAt", { ascending: false });

    if (error) {
      throw error;
    }

    const domain = "https://gamegata.xyz";
    const staticPages = [
      { loc: `${domain}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${domain}/upcoming`, changefreq: "daily", priority: "0.8" },
      { loc: `${domain}/legal`, changefreq: "monthly", priority: "0.3" },
      { loc: `${domain}/privacy`, changefreq: "monthly", priority: "0.3" },
    ];

    const xmlItems = staticPages.map(page => `
  <url>
    <loc>${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

    const gameItems = (games || []).map(game => `
  <url>
    <loc>${domain}/game/${game.slug}</loc>
    <lastmod>${new Date(game.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('');

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
${gameItems}
</urlset>`;

    return new Response(sitemapXml.trim(), {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400"
      }
    });
  } catch (err) {
    console.error("❌ Sitemap generation failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
