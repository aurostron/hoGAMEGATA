import "./load-env";
import * as cheerio from "cheerio";
import { getMoodTagsForGame } from "./mood-rules";
import {
  turso,
  schema,
  eq,
  getOrCreateTag,
  getOrCreateDeveloper,
  saveGame,
  generateId
} from "./db-helper";

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

async function fetchDeveloperAvatar(username: string): Promise<string | null> {
  const profileUrl = `https://itch.io/profile/${username}`;
  try {
    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const avatarDiv = $('.avatar');
    if (avatarDiv.length) {
      const bgImage = avatarDiv.attr('style');
      if (bgImage) {
        const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match) {
          const parsedUrl = match[1];
          if (parsedUrl.includes("itch.zone") || parsedUrl.includes("itch.io/image")) {
            return parsedUrl;
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error scraping developer avatar for ${username}:`, e);
  }
  return null;
}

async function addCustomItchGame(title: string, itchUrl: string) {
  const cleanSlug = "itch-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  console.log(`Adding entry for "${title}" with slug "${cleanSlug}"...`);

  console.log(`🔍 Fetching and scraping details from ${itchUrl}...`);
  const html = await fetchHtmlWithBackoff(itchUrl);
  
  let screenshots: string[] = [];
  let summaryHtml: string | null = null;
  let coverUrl: string | null = null;
  let extractedTags: string[] = [];
  let developerName: string | null = null;
  let scrapedReleaseDate: Date | null = null;

  if (html) {
    const $ = cheerio.load(html);
    coverUrl = $('meta[property="og:image"]').attr('content') || 
               $('meta[name="twitter:image"]').attr('content') || null;

    $('.screenshot_list a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.endsWith('.png') || href.endsWith('.jpg') || href.endsWith('.gif') || href.includes('itch.zone'))) {
        screenshots.push(href);
      }
    });

    const desc = $('.formatted_description').html();
    if (desc) {
      summaryHtml = desc.trim();
    }

    $('a[href^="https://itch.io/games/tag-"], a[href^="https://itch.io/games/genre-"]').each((i, el) => {
      const tagText = $(el).text().trim();
      if (tagText) extractedTags.push(tagText);
    });

    const authorLink = $('.game_header .breadcrumb a, .game_info_panel a[href*=".itch.io"], a.profile_link, .author_name a').first();
    if (authorLink.length) {
      developerName = authorLink.text().trim();
    }
    
    let dateCell = $('table td, table th').filter((i, el) => {
      const text = $(el).text().toLowerCase().trim();
      return text === 'published' || text === 'release date' || text === 'released';
    }).next('td');

    if (!dateCell.length) {
      dateCell = $('table td, table th').filter((i, el) => {
        const text = $(el).text().toLowerCase().trim();
        return text === 'updated';
      }).next('td');
    }

    if (dateCell.length) {
      const abbr = dateCell.find('abbr');
      let rawDateText = abbr.attr('title') || dateCell.text().trim();
      if (rawDateText) {
        rawDateText = rawDateText.replace('@', '').replace(/\s+/g, ' ').trim();
        const parsed = Date.parse(rawDateText);
        if (!isNaN(parsed)) {
          scrapedReleaseDate = new Date(parsed);
        }
      }
    }
    
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

  let developerId: string | null = null;
  let avatarUrl: string | null = null;
  
  const itchSubdomainMatch = itchUrl.match(/https?:\/\/([^.]+)\.itch\.io/);
  const itchUsername = itchSubdomainMatch ? itchSubdomainMatch[1] : null;
  
  if (itchUsername) {
    console.log(`🔍 Scraping developer avatar from profile page...`);
    avatarUrl = await fetchDeveloperAvatar(itchUsername);
    if (avatarUrl) {
      console.log(`... Found developer avatar: ${avatarUrl}`);
    }
  }

  if (developerName) {
    const devSlug = developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    developerId = await getOrCreateDeveloper(developerName, devSlug, null, avatarUrl);
  }

  const plaintextSummary = summaryHtml ? cheerio.load(summaryHtml).text().trim() : "";

  const gameInput = {
    title,
    summary: plaintextSummary,
    storyline: null,
    genres: [{ name: "Horror", slug: "horror" }],
    keywords: extractedTags.map(t => ({ name: t, slug: t.toLowerCase().replace(/[^a-z0-9]/g, '-') }))
  };
  let moodTags: Array<{ name: string; slug: string }> = [];
  try {
    moodTags = await getMoodTagsForGame(gameInput);
  } catch (moodErr) {
    console.warn(`⚠️ Failed to map mood tags:`, moodErr);
  }

  const allTagsToProcess = [
    ...extractedTags.map(t => ({ name: t, slug: t.toLowerCase().replace(/[^a-z0-9]/g, '-') })),
    ...moodTags.map(t => ({ name: t.name, slug: t.slug }))
  ];
  const uniqueTags = Array.from(new Map(allTagsToProcess.map(t => [t.slug, t])).values());

  const tagIds: string[] = [];
  for (const t of uniqueTags) {
    const tId = await getOrCreateTag(t.name, t.slug);
    tagIds.push(tId);
  }

  let existingGame: any = null;
  const [row] = await turso
    .select()
    .from(schema.games)
    .where(eq(schema.games.slug, cleanSlug))
    .limit(1);
  if (row) {
    existingGame = row;
  }

  const gameData: any = {
    id: existingGame?.id,
    title,
    slug: cleanSlug,
    status: "released",
    rawgEnriched: true,
    lastRawgSync: new Date(),
    purchaseLinks: [{ storeName: "itch.io", url: itchUrl }]
  };

  if (summaryHtml) gameData.summary = summaryHtml;
  if (coverUrl) gameData.coverUrl = coverUrl;
  if (screenshots.length > 0) gameData.screenshots = screenshots;
  if (scrapedReleaseDate) gameData.releaseDate = scrapedReleaseDate;
  if (developerName) {
    gameData.developerNames = developerName;
    if (developerId) gameData.developerIds = [developerId];
  }
  if (tagIds.length > 0) {
    gameData.tagIds = tagIds;
  }

  const savedGameId = await saveGame(gameData);
  console.log(`✅ Game entry "${title}" successfully added and enriched (ID: ${savedGameId}).`);
}

async function main() {
  const args = process.argv.slice(2);
  const titleIndex = args.indexOf("--title");
  const urlIndex = args.indexOf("--url");

  if (titleIndex === -1 || urlIndex === -1 || !args[titleIndex + 1] || !args[urlIndex + 1]) {
    console.error("❌ Error: Missing arguments. Usage: tsx scripts/add-custom-itch.ts --title \"Game Title\" --url \"https://username.itch.io/game-slug\"");
    process.exit(1);
  }

  const title = args[titleIndex + 1].trim();
  const url = args[urlIndex + 1].trim();

  await addCustomItchGame(title, url);
}

main().catch(console.error);
