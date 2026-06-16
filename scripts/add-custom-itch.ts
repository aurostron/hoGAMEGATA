import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as cheerio from "cheerio";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fetchHtmlWithBackoff(url: string, retries = 3, delay = 2000): Promise<string | null> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (response.status === 429 && retries > 0) {
      console.warn(`⚠️ Itch.io returned 429. Retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchHtmlWithBackoff(url, retries - 1, delay * 2);
    }
    if (!response.ok) {
      console.warn(`⚠️ Itch.io returned ${response.status} for ${url}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    if (retries > 0) {
      console.warn(`⚠️ Network error: ${error}. Retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchHtmlWithBackoff(url, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function addCustomItchGame(title: string, itchUrl: string) {
  const cleanSlug = "itch-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  console.log(`Adding entry for "${title}" with slug "${cleanSlug}"...`);

  // Fetch HTML page to scrape metadata immediately
  console.log(`🔍 Fetching and scraping details from ${itchUrl}...`);
  const html = await fetchHtmlWithBackoff(itchUrl);
  
  let screenshots: string[] = [];
  let summaryHtml: string | null = null;
  let coverUrl: string | null = null;
  let extractedTags: string[] = [];
  let developerName: string | null = null;

  if (html) {
    const $ = cheerio.load(html);
    
    // Extract cover image from OpenGraph / Twitter meta tags
    coverUrl = $('meta[property="og:image"]').attr('content') || 
               $('meta[name="twitter:image"]').attr('content') || null;

    // Extract screenshots
    $('.screenshot_list a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.endsWith('.png') || href.endsWith('.jpg') || href.endsWith('.gif') || href.includes('itch.zone'))) {
        screenshots.push(href);
      }
    });

    // Extract description formatted HTML
    const desc = $('.formatted_description').html();
    if (desc) {
      summaryHtml = desc.trim();
    }

    // Extract tags
    $('a[href^="https://itch.io/games/tag-"], a[href^="https://itch.io/games/genre-"]').each((i, el) => {
      const tagText = $(el).text().trim();
      if (tagText) extractedTags.push(tagText);
    });

    // Try breadcrumbs or author link selectors
    const authorLink = $('.game_header .breadcrumb a, .game_info_panel a[href*=".itch.io"], a.profile_link, .author_name a').first();
    if (authorLink.length) {
      developerName = authorLink.text().trim();
    }
    
    // Fallback: extract username from the URL path if possible
    if (!developerName) {
      const canonical = $('link[rel="canonical"]').attr('href');
      if (canonical) {
        const match = canonical.match(/https?:\/\/([^.]+)\.itch\.io/);
        if (match) {
          developerName = match[1];
        }
      }
    }
    
    console.log(`✨ Scraped successfully: found ${screenshots.length} screenshots, cover image, and ${extractedTags.length} tags.`);
  } else {
    console.warn(`⚠️ Could not fetch details from ${itchUrl}. Initializing default database record.`);
  }

  // If developer name not extracted from HTML, extract from the URL subdomain
  if (!developerName) {
    const match = itchUrl.match(/https?:\/\/([^.]+)\.itch\.io/);
    if (match) {
      const extractedDevName = match[1];
      developerName = extractedDevName
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
  }

  let developerConnect: any = undefined;
  if (developerName) {
    const devSlug = developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const dbDev = await prisma.developer.upsert({
      where: { slug: devSlug },
      update: { name: developerName },
      create: { name: developerName, slug: devSlug }
    });
    developerConnect = {
      connect: { id: dbDev.id }
    };
  }

  // Create or Update the game entry
  const game = await prisma.game.upsert({
    where: { slug: cleanSlug },
    update: {
      title,
      status: "released",
      rawgEnriched: !!html,
      lastRawgSync: html ? new Date() : null,
      summary: summaryHtml || undefined,
      coverUrl: coverUrl || undefined,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      developerNames: developerName || undefined,
      developers: developerConnect,
    },
    create: {
      title,
      slug: cleanSlug,
      status: "released",
      rawgEnriched: !!html,
      lastRawgSync: html ? new Date() : null,
      summary: summaryHtml,
      coverUrl,
      screenshots,
      developerNames: developerName || null,
      developers: developerConnect,
      purchaseLinks: {
        create: {
          storeName: "itch.io",
          url: itchUrl,
        },
      },
    },
  });

  // Connect tags to database
  if (extractedTags.length > 0) {
    for (const tag of extractedTags) {
      const tagSlug = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const dbTag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: {},
        create: {
          name: tag,
          slug: tagSlug,
        }
      });
      await prisma.game.update({
        where: { id: game.id },
        data: {
          tags: {
            connect: { id: dbTag.id }
          }
        }
      });
    }
  }

  console.log(`✅ Game entry "${title}" successfully added and enriched (ID: ${game.id}).`);
}

// Check command line arguments for Title and URL
const args = process.argv.slice(2);
const titleArg = args[0];
const urlArg = args[1];

if (!titleArg || !urlArg) {
  console.log("Usage: npx tsx scripts/add-custom-itch.ts \"Game Title\" \"https://author.itch.io/game\"");
  process.exit(1);
}

addCustomItchGame(titleArg, urlArg)
  .then(() => {
    prisma.$disconnect();
    pool.end();
  })
  .catch((err) => {
    console.error("❌ Add Entry Error:", err);
    prisma.$disconnect();
    pool.end();
  });
