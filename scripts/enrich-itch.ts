import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as cheerio from "cheerio";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in your .env file.");
  process.exit(1);
}

let prisma: PrismaClient;
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 60000,
  max: 10,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtmlWithBackoff(url: string, retries = 3, delay = 2000): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (response.status === 429 && retries > 0) {
      console.warn(`⚠️ Itch.io returned 429 (Too Many Requests). Retrying in ${delay}ms...`);
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

async function runEnrichment() {
  const args = process.argv.slice(2);
  let batchLimit = 20;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      batchLimit = parsedLimit;
    }
  }

  console.log(`🧹 Querying database for up to ${batchLimit} unenriched itch.io games...`);
  
  // Find games with an itch.io purchase link where rawgEnriched is false
  const purchaseLinks = await prisma.purchaseLink.findMany({
    where: {
      storeName: 'itch.io',
      game: {
        rawgEnriched: false,
        slug: { startsWith: 'itch-' } // Safety check
      }
    },
    include: { game: true },
    take: batchLimit,
  });

  const count = purchaseLinks.length;
  if (count === 0) {
    console.log("🎉 All itch.io games in the database are already enriched!");
    return;
  }

  console.log(`📚 Found ${count} games to process. Starting scraping...`);

  let enrichedCount = 0;

  for (const link of purchaseLinks) {
    const game = link.game;
    console.log(`\n🔄 Scraping: ${game.title} at ${link.url}`);
    
    const html = await fetchHtmlWithBackoff(link.url);
    if (!html) {
      console.log(`  ❌ Failed to fetch HTML for ${game.title}. Skipping.`);
      continue;
    }

    const $ = cheerio.load(html);

    // 1. Extract Screenshots
    const screenshots: string[] = [];
    $('.screenshot_list a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.endsWith('.png') || href.endsWith('.jpg') || href.endsWith('.gif') || href.includes('itch.zone'))) {
        screenshots.push(href);
      }
    });

    // 2. Extract Description
    let summaryHtml = $('.formatted_description').html();
    if (summaryHtml) {
       // Optional: Clean up standard itch.io injected classes if you prefer, 
       // but typically raw HTML is fine if your frontend handles it safely.
       summaryHtml = summaryHtml.trim();
    }

    // 3. Extract Tags/Genres from the right sidebar or footer
    const extractedTags: string[] = [];
    $('a[href^="https://itch.io/games/tag-"], a[href^="https://itch.io/games/genre-"]').each((i, el) => {
      const tagText = $(el).text().trim();
      if (tagText) extractedTags.push(tagText);
    });

    // 4. Update the Game record in the database
    try {
      const updateData: any = {
        rawgEnriched: true, // Mark as enriched
        lastRawgSync: new Date(),
      };

      if (screenshots.length > 0) updateData.screenshots = screenshots;
      if (summaryHtml) updateData.summary = summaryHtml; // Overwrite summary

      await prisma.game.update({
        where: { id: game.id },
        data: updateData
      });

      // Optionally, connect tags if you want to integrate with your Tag model
      for (const tag of extractedTags) {
         const slug = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
         await prisma.tag.upsert({
           where: { slug },
           update: {
             games: { connect: { id: game.id } }
           },
           create: {
             name: tag,
             slug: slug,
             games: { connect: { id: game.id } }
           }
         });
      }

      console.log(`  ✅ Enriched ${game.title} with ${screenshots.length} screenshots and ${extractedTags.length} tags.`);
      enrichedCount++;
    } catch (err) {
      console.error(`  ❌ Database update failed for ${game.title}:`, err);
    }

    // Wait 3-6 seconds to be polite to the itch.io servers and prevent IP bans
    const delay = Math.floor(Math.random() * 3000) + 3000;
    console.log(`  ⏳ Waiting ${delay}ms before next game...`);
    await sleep(delay);
  }

  console.log(`\n🎉 Web scraping batch complete! Enriched ${enrichedCount} of ${count} games.`);
}

runEnrichment()
  .then(() => {
    prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Scraper Error:", err);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
