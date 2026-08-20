import { turso } from './turso';
import { siteContent } from '../db/schema';
import { eq } from 'drizzle-orm';

export const DEFAULT_CONTENT = [
  {
    key: "hero_title",
    value: "hoGAMEGATA.",
    type: "text",
    label: "Hero Title",
    section: "homepage"
  },
  {
    key: "hero_subtitle",
    value: "Discover 107,000+ horror games, 68,000+ developers, and 430,000+ screenshots. A fast, minimal, and premium metadata registry for survival horror, psychological horror, and indie nightmare games.",
    type: "text",
    label: "Hero Subtitle",
    section: "homepage"
  },
  {
    key: "catalogue_title",
    value: "Explore our catalogue",
    type: "text",
    label: "Catalogue CTA Title",
    section: "catalog"
  },
  {
    key: "catalogue_desc",
    value: "Over 107,000 horror games waiting for you to discover. Filter by 68,000+ developers, 15,800+ tags, scare intensity, platform, and pricing to pinpoint your next favorite nightmare.",
    type: "text",
    label: "Catalogue CTA Description",
    section: "catalog"
  },
  {
    key: "support_title",
    value: "Help keep the project alive",
    type: "text",
    label: "Support Heading",
    section: "support"
  },
  {
    key: "support_desc",
    value: "hoGAMEGATA is a free, ad-free database. We never show ads, sell user data, or lock features behind paywalls. If you value horror game preservation or just like the purpose of this project, help us cover our database hosting and API operating costs.",
    type: "text",
    label: "Support Description",
    section: "support"
  }
];

export async function getOrSeedContent() {
  try {
    const current = await turso.select().from(siteContent);
    const dbMap = new Map(current.map(item => [item.key, item]));

    let updatedCount = 0;
    for (const item of DEFAULT_CONTENT) {
      if (!dbMap.has(item.key)) {
        await turso.insert(siteContent).values({
          key: item.key,
          value: item.value,
          type: item.type,
          label: item.label,
          section: item.section,
          updatedAt: new Date()
        }).onConflictDoNothing();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      return await turso.select().from(siteContent);
    }

    return current;
  } catch (e) {
    console.error("Failed to fetch site content from Turso:", e);
    return DEFAULT_CONTENT;
  }
}

export async function getContentMap() {
  const list = await getOrSeedContent();
  const map: Record<string, string> = {};
  for (const item of list) {
    map[item.key] = item.value;
  }
  return map;
}
