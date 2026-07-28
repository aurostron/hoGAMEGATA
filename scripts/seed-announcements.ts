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

  console.log("🌱 Seeding complete version history from project inception to today into Turso DB...");

  const items = [
    {
      id: 'ver-12',
      title: 'Updates Engine & Admin Console',
      version: 'v0.9.5',
      category: 'feature',
      date: new Date('2026-08-09T22:30:00Z'),
      summary: 'Added header updates widget with changelog history, announcements, and admin management controls.',
      isPublished: true,
      createdAt: new Date('2026-08-09T22:30:00Z'),
      updatedAt: new Date('2026-08-09T22:30:00Z'),
    },
    {
      id: 'ver-11',
      title: 'Metadata Edits & Linux Compatibility',
      version: 'v0.9.4',
      category: 'feature',
      date: new Date('2026-08-08T19:00:00Z'),
      summary: 'Added metadata edit submissions for ratings, average playtime, platform checkboxes, and automated ProtonDB checks.',
      isPublished: true,
      createdAt: new Date('2026-08-08T19:00:00Z'),
      updatedAt: new Date('2026-08-08T19:00:00Z'),
    },
    {
      id: 'ver-10',
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
      id: 'ver-9',
      title: 'UI Refinement & Clean Typography',
      version: 'v0.9.2',
      category: 'changelog',
      date: new Date('2026-08-08T16:00:00Z'),
      summary: 'Simplified copy and polished typography across all storefront pages for a clean browsing experience.',
      isPublished: true,
      createdAt: new Date('2026-08-08T16:00:00Z'),
      updatedAt: new Date('2026-08-08T16:00:00Z'),
    },
    {
      id: 'ver-8',
      title: 'Community Edit Engine & AI Shield',
      version: 'v0.9.1',
      category: 'feature',
      date: new Date('2026-08-02T12:00:00Z'),
      summary: 'Introduced community edit suggestions with automated AI moderation shields and Discord webhooks.',
      isPublished: true,
      createdAt: new Date('2026-08-02T12:00:00Z'),
      updatedAt: new Date('2026-08-02T12:00:00Z'),
    },
    {
      id: 'ver-7',
      title: 'Public Beta Launch (v0.9.0-beta.1)',
      version: 'v0.9.0',
      category: 'announcement',
      date: new Date('2026-07-08T10:00:00Z'),
      summary: 'Official Public Beta release featuring catalog directory, Bayesian scoring, and Cloudflare Workers deployment.',
      isPublished: true,
      createdAt: new Date('2026-07-08T10:00:00Z'),
      updatedAt: new Date('2026-07-08T10:00:00Z'),
    },
    {
      id: 'ver-6',
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
      id: 'ver-5',
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
      id: 'ver-4',
      title: 'Cart CDN Caching & Price Sync',
      version: 'v0.8.0',
      category: 'changelog',
      date: new Date('2026-07-16T09:00:00Z'),
      summary: 'Added CDN image caching for cart items and improved retail deal lookup across stores.',
      isPublished: true,
      createdAt: new Date('2026-07-16T09:00:00Z'),
      updatedAt: new Date('2026-07-16T09:00:00Z'),
    },
    {
      id: 'ver-3',
      title: 'Admin Operations & 2FA Auth',
      version: 'v0.7.0',
      category: 'feature',
      date: new Date('2026-07-12T15:00:00Z'),
      summary: 'Added TOTP 2FA admin authentication, mobile analytics dashboard, and image gallery manager.',
      isPublished: true,
      createdAt: new Date('2026-07-12T15:00:00Z'),
      updatedAt: new Date('2026-07-12T15:00:00Z'),
    },
    {
      id: 'ver-2',
      title: 'Initial Public Site Indexing',
      version: 'v0.5.0',
      category: 'announcement',
      date: new Date('2026-06-25T12:00:00Z'),
      summary: 'Opened storefront catalog for public search engine indexing with Open Graph & video game metadata.',
      isPublished: true,
      createdAt: new Date('2026-06-25T12:00:00Z'),
      updatedAt: new Date('2026-06-25T12:00:00Z'),
    },
    {
      id: 'ver-1',
      title: 'Project Inception & Core Storefront',
      version: 'v0.1.0',
      category: 'announcement',
      date: new Date('2026-06-15T09:00:00Z'),
      summary: 'Initial codebase creation, Turso database schema initialization, and Astro core architecture.',
      isPublished: true,
      createdAt: new Date('2026-06-15T09:00:00Z'),
      updatedAt: new Date('2026-06-15T09:00:00Z'),
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

  console.log(`✅ Successfully seeded ${items.length} complete version items into Turso DB!`);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
