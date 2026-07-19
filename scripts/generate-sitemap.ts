import { turso, schema, desc } from "./db-helper";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("📡 Starting static sitemap.xml generation...");

  try {
    // 1. Fetch games and devs from Turso
    console.log("📥 Querying games and developers from Turso...");
    const games = await turso
      .select({ slug: schema.games.slug, updatedAt: schema.games.updatedAt })
      .from(schema.games)
      .orderBy(desc(schema.games.updatedAt));

    const devs = await turso
      .select({ slug: schema.developers.slug })
      .from(schema.developers);

    console.log(`🎮 Found ${games.length} games and ${devs.length} developers.`);

    // 2. Fetch blog posts from Sanity via direct HTTP fetch to avoid virtual client import issues in node scripts
    const projectId = process.env.PUBLIC_SANITY_PROJECT_ID || "b85krrfu";
    const dataset = process.env.PUBLIC_SANITY_DATASET || "production";
    const groqQuery = `*[_type == "post" && defined(slug.current)] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }`;
    const sanityUrl = `https://${projectId}.api.sanity.io/v2021-10-21/data/query/${dataset}?query=${encodeURIComponent(groqQuery)}`;

    let blogPosts: any[] = [];
    try {
      const res = await fetch(sanityUrl);
      if (res.ok) {
        const data = await res.json() as { result: any[] };
        blogPosts = data.result || [];
        console.log(`📝 Found ${blogPosts.length} Sanity blog posts.`);
      } else {
        console.warn(`⚠️ Warning: Sanity API returned status ${res.status}`);
      }
    } catch (e) {
      console.error("❌ Sitemap generation failed to fetch Sanity posts:", e);
    }

    const domain = "https://gamegata.xyz";
    const staticPages = [
      { loc: `${domain}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${domain}/directory`, changefreq: "daily", priority: "0.9" },
      { loc: `${domain}/games`, changefreq: "daily", priority: "0.9" },
      { loc: `${domain}/upcoming`, changefreq: "daily", priority: "0.8" },
      { loc: `${domain}/blog`, changefreq: "daily", priority: "0.8" },
      { loc: `${domain}/about`, changefreq: "weekly", priority: "0.8" },
      { loc: `${domain}/support`, changefreq: "weekly", priority: "0.7" },
      { loc: `${domain}/contact`, changefreq: "monthly", priority: "0.5" },
      { loc: `${domain}/legal`, changefreq: "monthly", priority: "0.3" },
      { loc: `${domain}/privacy`, changefreq: "monthly", priority: "0.3" },
      { loc: `${domain}/terms`, changefreq: "monthly", priority: "0.3" },
    ];

    console.log("✍️ Assembling XML content...");
    const xmlItems = staticPages.map(page => `
  <url>
    <loc>${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

    const blogItems = blogPosts.map(post => {
      const dateStr = post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date().toISOString();
      return `
  <url>
    <loc>${domain}/blog/${post.slug}</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }).join('');

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
${blogItems}
</urlset>`;

    const destPath = path.join(process.cwd(), "public", "sitemap.xml");
    const destPathIndex = path.join(process.cwd(), "public", "sitemap-index.xml");
    
    console.log(`💾 Writing sitemap to: ${destPath}`);
    fs.writeFileSync(destPath, sitemapXml.trim(), "utf8");
    
    console.log(`💾 Writing cache-bypassing copy to: ${destPathIndex}`);
    fs.writeFileSync(destPathIndex, sitemapXml.trim(), "utf8");

    console.log("🎉 Static sitemap.xml generated successfully!");
  } catch (err) {
    console.error("❌ Static sitemap generation failed:", err);
    process.exit(1);
  }
}

main();
