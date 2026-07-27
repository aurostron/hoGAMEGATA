import { turso, schema, sql } from "./db-helper";

async function seed() {
  console.log("🛠️ Creating Announcement table in Turso DB if not exists...");

  await turso.run(sql`
    CREATE TABLE IF NOT EXISTS "Announcement" (
      "id" text PRIMARY KEY NOT NULL,
      "title" text NOT NULL,
      "summary" text NOT NULL,
      "version" text,
      "category" text DEFAULT 'changelog' NOT NULL,
      "date" integer NOT NULL,
      "linkUrl" text,
      "isPublished" integer DEFAULT 1 NOT NULL,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    )
  `);

  await turso.run(sql`
    CREATE INDEX IF NOT EXISTS "announcement_date_idx" ON "Announcement" ("date")
  `);

  await turso.run(sql`
    CREATE INDEX IF NOT EXISTS "announcement_category_idx" ON "Announcement" ("category")
  `);

  await turso.run(sql`
    CREATE INDEX IF NOT EXISTS "announcement_published_idx" ON "Announcement" ("isPublished")
  `);

  console.log("🌱 Seeding changelogs and announcements into Turso DB...");

  const items = [
    {
      id: 'changelog-9',
      title: 'Header Updates Engine',
      version: 'v0.9.5',
      category: 'feature',
      date: new Date('2026-08-09T22:30:00Z'),
      summary: 'Added header updates widget with changelog history, announcements, and lazy database fetch optimizations.',
      isPublished: true,
      createdAt: new Date('2026-08-09T22:30:00Z'),
      updatedAt: new Date('2026-08-09T22:30:00Z'),
    },
    {
      id: 'changelog-8',
      title: 'Metadata Edits & Linux ProtonDB Support',
      version: 'v0.9.4',
      category: 'feature',
      date: new Date('2026-08-08T19:00:00Z'),
      summary: 'Added metadata edit submissions for ratings, average playtime, platform checkboxes, and automated ProtonDB checks.',
      isPublished: true,
      createdAt: new Date('2026-08-08T19:00:00Z'),
      updatedAt: new Date('2026-08-08T19:00:00Z'),
    },
    {
      id: 'changelog-7',
      title: 'Header Fast-Load & Instant Cart Sync',
      version: 'v0.9.3',
      category: 'changelog',
      date: new Date('2026-08-08T17:00:00Z'),
      summary: 'Eliminated header load flicker with instant local cache for cart counts and user profile status.',
      isPublished: true,
      createdAt: new Date('2026-08-08T17:00:00Z'),
      updatedAt: new Date('2026-08-08T17:00:00Z'),
    },
    {
      id: 'changelog-6',
      title: 'UI Typography & Natural Phrasing',
      version: 'v0.9.2',
      category: 'changelog',
      date: new Date('2026-08-08T16:00:00Z'),
      summary: 'Simplified copy and polished typography across all storefront pages for a clean browsing experience.',
      isPublished: true,
      createdAt: new Date('2026-08-08T16:00:00Z'),
      updatedAt: new Date('2026-08-08T16:00:00Z'),
    },
    {
      id: 'changelog-5',
      title: 'Community Edits & AI Shield',
      version: 'v0.9.1',
      category: 'feature',
      date: new Date('2026-08-02T12:00:00Z'),
      summary: 'Introduced community edit suggestions with automated AI moderation shields and Discord webhooks.',
      isPublished: true,
      createdAt: new Date('2026-08-02T12:00:00Z'),
      updatedAt: new Date('2026-08-02T12:00:00Z'),
    },
    {
      id: 'changelog-4',
      title: 'Search Relevance & Speed Boost',
      version: 'v0.9.0',
      category: 'changelog',
      date: new Date('2026-08-02T10:00:00Z'),
      summary: 'Added title relevance ranking and stale query protection for faster search results.',
      isPublished: true,
      createdAt: new Date('2026-08-02T10:00:00Z'),
      updatedAt: new Date('2026-08-02T10:00:00Z'),
    },
    {
      id: 'changelog-3',
      title: 'SEO & Static Sitemap Engine',
      version: 'v0.8.8',
      category: 'changelog',
      date: new Date('2026-07-28T14:00:00Z'),
      summary: 'Converted sitemaps to static build generation and added JSON-LD schemas for search engines.',
      isPublished: true,
      createdAt: new Date('2026-07-28T14:00:00Z'),
      updatedAt: new Date('2026-07-28T14:00:00Z'),
    },
    {
      id: 'changelog-2',
      title: 'Database Query Speed Optimization',
      version: 'v0.8.5',
      category: 'changelog',
      date: new Date('2026-07-20T11:00:00Z'),
      summary: 'Eliminated catalog scan overheads for fast game page rendering and instant price comparisons.',
      isPublished: true,
      createdAt: new Date('2026-07-20T11:00:00Z'),
      updatedAt: new Date('2026-07-20T11:00:00Z'),
    },
    {
      id: 'changelog-1',
      title: 'Cart CDN Caching & Store Price Sync',
      version: 'v0.8.0',
      category: 'changelog',
      date: new Date('2026-07-16T09:00:00Z'),
      summary: 'Added CDN image caching for cart items and improved retail deal lookup across stores.',
      isPublished: true,
      createdAt: new Date('2026-07-16T09:00:00Z'),
      updatedAt: new Date('2026-07-16T09:00:00Z'),
    },
  ];

  for (const item of items) {
    await turso
      .insert(schema.announcements)
      .values(item)
      .onConflictDoUpdate({
        target: schema.announcements.id,
        set: {
          title: item.title,
          summary: item.summary,
          version: item.version,
          category: item.category,
          date: item.date,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`✅ Successfully created table and seeded ${items.length} announcements into Turso DB!`);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
