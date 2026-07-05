import type { APIRoute } from 'astro';
import { turso } from '../lib/turso';
import { games as gamesTable, developers as developersTable } from '../db/schema';
import { desc } from 'drizzle-orm';
import { sanityClient } from '../lib/sanity';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // 1. Fetch games and devs from Turso
    const games = await turso
      .select({ slug: gamesTable.slug, updatedAt: gamesTable.updatedAt })
      .from(gamesTable)
      .orderBy(desc(gamesTable.updatedAt));

    const devs = await turso
      .select({ slug: developersTable.slug })
      .from(developersTable);

    // 2. Fetch blog posts from Sanity (with error fallback)
    let blogPosts: any[] = [];
    try {
      blogPosts = await sanityClient.fetch(`
        *[_type == "post" && defined(slug.current)] {
          "slug": slug.current,
          "updatedAt": _updatedAt
        }
      `);
    } catch (e) {
      console.error("❌ Sitemap generation failed to fetch Sanity posts:", e);
    }

    const domain = "https://gamegata.xyz";
    const staticPages = [
      { loc: `${domain}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${domain}/games`, changefreq: "daily", priority: "0.9" },
      { loc: `${domain}/upcoming`, changefreq: "daily", priority: "0.8" },
      { loc: `${domain}/blog`, changefreq: "daily", priority: "0.8" },
      { loc: `${domain}/support`, changefreq: "weekly", priority: "0.7" },
      { loc: `${domain}/about`, changefreq: "monthly", priority: "0.5" },
      { loc: `${domain}/contact`, changefreq: "monthly", priority: "0.5" },
      { loc: `${domain}/legal`, changefreq: "monthly", priority: "0.3" },
      { loc: `${domain}/privacy`, changefreq: "monthly", priority: "0.3" },
      { loc: `${domain}/terms`, changefreq: "monthly", priority: "0.3" },
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

    const devItems = (devs || []).map(dev => `
  <url>
    <loc>${domain}/developer/${dev.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`).join('');

    const blogItems = (blogPosts || []).map(post => `
  <url>
    <loc>${domain}/blog/${post.slug}</loc>
    <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
${gameItems}
${devItems}
${blogItems}
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
