import "./load-env";
import * as cheerio from "cheerio";
import * as readline from "readline";
import { getMoodTagsForGame } from "./mood-rules";
import {
  turso,
  schema,
  eq,
  or,
  like,
  inArray,
  lt,
  isNull,
  getOrCreateTag,
  getOrCreateDeveloper,
  saveGame,
  generateId
} from "./db-helper";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

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

interface ScrapedMetadata {
  screenshots: string[];
  summaryHtml: string | null;
  coverUrl: string | null;
  extractedTags: string[];
  developerName: string | null;
  releaseDate?: Date | null;
}

function parseItchPage(html: string): ScrapedMetadata {
  const $ = cheerio.load(html);
  
  const coverUrl = $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="twitter:image"]').attr('content') || null;

  const screenshots: string[] = [];
  $('.screenshot_list a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && (href.endsWith('.png') || href.endsWith('.jpg') || href.endsWith('.gif') || href.includes('itch.zone'))) {
      screenshots.push(href);
    }
  });

  let summaryHtml: string | null = null;
  const desc = $('.formatted_description').html();
  if (desc) {
    summaryHtml = desc.trim();
  }

  const extractedTags: string[] = [];
  $('a[href^="https://itch.io/games/tag-"], a[href^="https://itch.io/games/genre-"]').each((i, el) => {
    const tagText = $(el).text().trim();
    if (tagText) extractedTags.push(tagText);
  });

  let developerName: string | null = null;
  const authorLink = $('.game_header .breadcrumb a, .game_info_panel a[href*=".itch.io"], a.profile_link, .author_name a').first();
  if (authorLink.length) {
    developerName = authorLink.text().trim();
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

  let releaseDate: Date | null = null;
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
        releaseDate = new Date(parsed);
      }
    }
  }

  return { coverUrl, screenshots, summaryHtml, extractedTags, developerName, releaseDate };
}

async function enrichGameDetails(gameId: string, title: string, url: string): Promise<boolean> {
  console.log(`\n🔄 Scraping: ${title} at ${url}`);
  const html = await fetchHtmlWithBackoff(url);
  if (!html) {
    console.log(`  ❌ Failed to fetch HTML for ${title}. Skipping.`);
    await turso
      .update(schema.games)
      .set({ lastRawgSync: new Date() })
      .where(eq(schema.games.id, gameId))
      .catch(e => console.error(`Failed to update lastRawgSync on scrape failure for ${title}:`, e));
    return false;
  }

  const { coverUrl, screenshots, summaryHtml, extractedTags, developerName, releaseDate } = parseItchPage(html);

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
    console.warn(`  ⚠️ Failed to map mood tags:`, moodErr);
  }

  const allTagsToProcess = [
    ...extractedTags.map(t => ({ name: t, slug: t.toLowerCase().replace(/[^a-z0-9]/g, '-') })),
    ...moodTags.map(t => ({ name: t.name, slug: t.slug }))
  ];

  const uniqueTags = Array.from(new Map(allTagsToProcess.map(t => [t.slug, t])).values());

  try {
    const updateData: any = {
      rawgEnriched: true,
      lastRawgSync: new Date(),
    };

    if (coverUrl) updateData.coverUrl = coverUrl;
    if (summaryHtml) updateData.summary = summaryHtml;
    if (screenshots.length > 0) updateData.screenshots = screenshots;
    if (releaseDate) updateData.releaseDate = releaseDate;

    if (developerName) {
      const devSlug = developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      
      let avatarUrl: string | null = null;
      const itchSubdomainMatch = url.match(/https?:\/\/([^.]+)\.itch\.io/);
      const itchUsername = itchSubdomainMatch ? itchSubdomainMatch[1] : null;
      if (itchUsername) {
        avatarUrl = await fetchDeveloperAvatar(itchUsername);
      }

      const devId = await getOrCreateDeveloper(developerName, devSlug, null, avatarUrl);
      updateData.developerIds = [devId];
      updateData.developerNames = developerName;
    }

    const tagIds: string[] = [];
    if (uniqueTags.length > 0) {
      for (const t of uniqueTags) {
        const tId = await getOrCreateTag(t.name, t.slug);
        tagIds.push(tId);
      }
    }

    if (tagIds.length > 0) {
      updateData.tagIds = tagIds;
    }

    // Perform the save update
    await saveGame({
      id: gameId,
      title,
      slug: "itch-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      ...updateData
    });

    console.log(`  ✅ Enriched ${title} with ${screenshots.length} screenshots and ${uniqueTags.length} tags.`);
    return true;
  } catch (err) {
    console.error(`  ❌ Database update failed for ${title}:`, err);
    return false;
  }
}

async function addAndEnrichCustomGame(title: string, url: string) {
  const cleanSlug = "itch-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  console.log(`\nAdding entry for "${title}" with slug "${cleanSlug}"...`);

  // Check if game exists
  let gameId = "";
  const [existing] = await turso
    .select()
    .from(schema.games)
    .where(eq(schema.games.slug, cleanSlug))
    .limit(1);

  if (existing) {
    gameId = existing.id;
  }

  const savedGameId = await saveGame({
    id: gameId || undefined,
    title,
    slug: cleanSlug,
    status: "released",
    purchaseLinks: [{ storeName: "itch.io", url }]
  });

  await enrichGameDetails(savedGameId, title, url);
  console.log(`✅ Game entry "${title}" successfully added and enriched (ID: ${savedGameId}).`);
}

async function addCustomGameDryRun(title: string, url: string, coverUrl: string | null, developerName: string | null) {
  const cleanSlug = "itch-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  console.log(`\n[Dry Run] Adding skeleton entry for "${title}" with slug "${cleanSlug}"...`);

  let gameId = "";
  const [existing] = await turso
    .select()
    .from(schema.games)
    .where(eq(schema.games.slug, cleanSlug))
    .limit(1);

  if (existing) {
    gameId = existing.id;
  }

  const baseData: any = {
    title,
    status: "released",
    rawgEnriched: false,
  };
  
  if (coverUrl) baseData.coverUrl = coverUrl;
  if (developerName) baseData.developerNames = developerName;

  if (developerName) {
    const devSlug = developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const devId = await getOrCreateDeveloper(developerName, devSlug);
    baseData.developerIds = [devId];
  }

  baseData.purchaseLinks = [{ storeName: "itch.io", url }];

  const savedGameId = await saveGame({
    id: gameId || undefined,
    slug: cleanSlug,
    ...baseData
  });

  console.log(`✅ [Dry Run] Skeleton entry created (ID: ${savedGameId}) with developer: "${developerName || "Unknown"}" and cover.`);
}

async function runEnrichmentBatch(batchLimit: number) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log(`🧹 Querying database for up to ${batchLimit} unenriched itch.io games...`);

  // Drizzle query for itch.io purchase links for games where rawgEnriched is false
  const results = await turso
    .select({
      id: schema.purchaseLinks.id,
      url: schema.purchaseLinks.url,
      gameId: schema.games.id,
      gameTitle: schema.games.title,
      gameSlug: schema.games.slug
    })
    .from(schema.purchaseLinks)
    .innerJoin(schema.games, eq(schema.purchaseLinks.gameId, schema.games.id))
    .where(
      and(
        eq(schema.purchaseLinks.storeName, "itch.io"),
        eq(schema.games.rawgEnriched, false),
        like(schema.games.slug, "itch-%"),
        or(
          isNull(schema.games.lastRawgSync),
          lt(schema.games.lastRawgSync, thirtyDaysAgo)
        )
      )
    )
    .limit(batchLimit);

  const countVal = results.length;
  if (countVal === 0) {
    console.log("🎉 All itch.io games in the database are already enriched!");
    return;
  }

  console.log(`📚 Found ${countVal} games to process. Starting scraping...`);
  let enrichedCount = 0;

  for (const link of results) {
    const success = await enrichGameDetails(link.gameId, link.gameTitle, link.url);
    if (success) enrichedCount++;

    const delay = Math.floor(Math.random() * 3000) + 3000;
    console.log(`  ⏳ Waiting ${delay}ms before next game...`);
    await sleep(delay);
  }

  console.log(`\n🎉 Web scraping batch complete! Enriched ${enrichedCount} of ${countVal} games.`);
}

async function runEnrichmentSingle(filter: { slug?: string; url?: string }) {
  let results: any[] = [];

  if (filter.slug) {
    console.log(`🎯 Targeted enrichment by slug: "${filter.slug}"`);
    results = await turso
      .select({
        url: schema.purchaseLinks.url,
        gameId: schema.games.id,
        gameTitle: schema.games.title
      })
      .from(schema.purchaseLinks)
      .innerJoin(schema.games, eq(schema.purchaseLinks.gameId, schema.games.id))
      .where(
        and(
          eq(schema.purchaseLinks.storeName, "itch.io"),
          eq(schema.games.slug, filter.slug)
        )
      );
  } else if (filter.url) {
    console.log(`🎯 Targeted enrichment by URL: "${filter.url}"`);
    results = await turso
      .select({
        url: schema.purchaseLinks.url,
        gameId: schema.games.id,
        gameTitle: schema.games.title
      })
      .from(schema.purchaseLinks)
      .innerJoin(schema.games, eq(schema.purchaseLinks.gameId, schema.games.id))
      .where(
        and(
          eq(schema.purchaseLinks.storeName, "itch.io"),
          eq(schema.purchaseLinks.url, filter.url)
        )
      );
  }

  const countVal = results.length;
  if (countVal === 0) {
    console.log("❌ No matching itch.io games found in database.");
    return;
  }

  for (const link of results) {
    await enrichGameDetails(link.gameId, link.gameTitle, link.url);
  }
}

async function scrapeItchListingPage(listingUrl: string): Promise<Array<{ title: string, url: string, coverUrl: string | null, developerName: string | null }>> {
  console.log(`🔍 Scrape Request: Fetching list from ${listingUrl}...`);
  let html = await fetchHtmlWithBackoff(listingUrl);
  
  if (!html) {
    const match = listingUrl.match(/https:\/\/itch\.io\/games\/([a-zA-Z0-9\-]+)\/(tag\-[a-zA-Z0-9\-]+\/tag\-[a-zA-Z0-9\-]+.*)/);
    if (match) {
      const fallbackUrl = `https://itch.io/games/${match[2]}`;
      console.warn(`⚠️ Cloudflare blocked sorted combined tag URL (403). Falling back to unsorted combined listing: ${fallbackUrl}`);
      html = await fetchHtmlWithBackoff(fallbackUrl);
    }
  }

  if (!html) {
    console.error("  ❌ Failed to fetch list page HTML.");
    return [];
  }

  const $ = cheerio.load(html);
  const games: Array<{ title: string, url: string, coverUrl: string | null, developerName: string | null }> = [];

  $('.game_cell, .grid_cell').each((i, el) => {
    const titleEl = $(el).find('.game_title a, .title a');
    const title = titleEl.text().trim();
    const url = titleEl.attr('href');
    
    const imgEl = $(el).find('.game_thumb img');
    let coverUrl = imgEl.attr('data-lazy') || imgEl.attr('src') || null;
    if (coverUrl && coverUrl.startsWith('//')) {
      coverUrl = `https:${coverUrl}`;
    }

    const devEl = $(el).find('.game_author a, .author a');
    const developerName = devEl.text().trim() || null;

    if (title && url && url.startsWith('http')) {
      games.push({ title, url, coverUrl, developerName });
    }
  });

  console.log(`✅ Extracted ${games.length} games from listing.`);
  return games;
}

async function runListIngestion(listingUrl: string, isDryRun: boolean = false) {
  const games = await scrapeItchListingPage(listingUrl);
  if (games.length === 0) {
    console.log("⚠️ No games found on the page or request failed.");
    return;
  }

  if (isDryRun) {
    console.log(`🚀 Dry Run: Seeding ${games.length} games to database instantly...`);
    let successCount = 0;
    for (const game of games) {
      try {
        await addCustomGameDryRun(game.title, game.url, game.coverUrl, game.developerName);
        successCount++;
      } catch (err) {
        console.error(`  ❌ Failed to dry-run seed "${game.title}":`, err);
      }
    }
    console.log(`\n🎉 Dry run listing ingestion complete! Seeded ${successCount} skeleton game entries.`);
    return;
  }

  console.log(`🚀 Full Run: Seeding and detailed-scraping ${games.length} games...`);
  
  let successCount = 0;
  for (const game of games) {
    const cleanSlug = "itch-" + game.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    
    const [existing] = await turso
      .select({ rawgEnriched: schema.games.rawgEnriched })
      .from(schema.games)
      .where(eq(schema.games.slug, cleanSlug))
      .limit(1);

    if (existing?.rawgEnriched) {
      console.log(`⏭️ "${game.title}" is already enriched. Skipping.`);
      continue;
    }

    try {
      await addAndEnrichCustomGame(game.title, game.url);
      successCount++;
      const delay = Math.floor(Math.random() * 3000) + 3000;
      console.log(`  ⏳ Waiting ${delay}ms before next game...`);
      await sleep(delay);
    } catch (err) {
      console.error(`  ❌ Failed to process "${game.title}":`, err);
    }
  }
  
  console.log(`\n🎉 Listing ingestion complete! Seeded and enriched ${successCount} new games.`);
}

async function showInteractiveMenu() {
  console.log("\n==================================================");
  console.log("🎮 ITCH.IO INGESTION & ENRICHMENT DASHBOARD");
  console.log("==================================================");
  console.log("1. Batch enrichment (scrape all unenriched games)");
  console.log("2. Enrich specific game by DB slug");
  console.log("3. Enrich specific game by itch.io URL");
  console.log("4. Add and enrich a new custom itch.io game");
  console.log("5. Import & enrich games from an itch.io listing page");
  console.log("6. Exit");
  console.log("==================================================");

  const choice = await askQuestion("Select option [1-6]: ");

  switch (choice) {
    case "1": {
      const limitStr = await askQuestion("Enter batch limit (default 20): ");
      const limit = parseInt(limitStr, 10) || 20;
      await runEnrichmentBatch(limit);
      break;
    }
    case "2": {
      const slug = await askQuestion("Enter game slug (e.g., itch-pyramida): ");
      if (!slug) {
        console.log("❌ Slug cannot be empty.");
        break;
      }
      await runEnrichmentSingle({ slug });
      break;
    }
    case "3": {
      const url = await askQuestion("Enter itch.io page URL: ");
      if (!url) {
        console.log("❌ URL cannot be empty.");
        break;
      }
      await runEnrichmentSingle({ url });
      break;
    }
    case "4": {
      const title = await askQuestion("Enter game title: ");
      const url = await askQuestion("Enter itch.io page URL: ");
      if (!title || !url) {
        console.log("❌ Title and URL cannot be empty.");
        break;
      }
      await addAndEnrichCustomGame(title, url);
      break;
    }
    case "5": {
      console.log("\nChoose or enter listing URL:");
      console.log("1. 3D Horror (Popular)     -> https://itch.io/games/tag-3d/tag-horror");
      console.log("2. 3D Horror (New & Pop)   -> https://itch.io/games/new-and-popular/tag-3d/tag-horror");
      console.log("3. 3D Horror (Top Rated)   -> https://itch.io/games/top-rated/tag-3d/tag-horror");
      console.log("4. Custom URL");
      
      const subChoice = await askQuestion("Select option [1-4]: ");
      let targetUrl = "";
      if (subChoice === "1") targetUrl = "https://itch.io/games/tag-3d/tag-horror";
      else if (subChoice === "2") targetUrl = "https://itch.io/games/new-and-popular/tag-3d/tag-horror";
      else if (subChoice === "3") targetUrl = "https://itch.io/games/top-rated/tag-3d/tag-horror";
      else if (subChoice === "4") {
        targetUrl = await askQuestion("Enter custom itch.io category/tag page URL: ");
      }

      if (!targetUrl) {
        console.log("❌ URL cannot be empty.");
        break;
      }
      
      const dryRunAns = await askQuestion("Do a fast dry run? (seeds titles/covers/devs instantly, redirects visitor) [Y/n]: ");
      const isDry = dryRunAns.toLowerCase() !== 'n';
      
      await runListIngestion(targetUrl, isDry);
      break;
    }
    case "6":
      console.log("👋 Exiting dashboard.");
      process.exit(0);
    default:
      console.log("❌ Invalid option. Try again.");
      await showInteractiveMenu();
  }
}

async function main() {
  const args = process.argv.slice(2);

  const slugIndex = args.indexOf("--slug");
  const urlIndex = args.indexOf("--url");
  const limitIndex = args.indexOf("--limit");
  const listUrlIndex = args.indexOf("--list-url");
  const isDryRun = args.includes("--dry-run");

  if (slugIndex !== -1 && args[slugIndex + 1]) {
    await runEnrichmentSingle({ slug: args[slugIndex + 1] });
  } else if (urlIndex !== -1 && args[urlIndex + 1]) {
    await runEnrichmentSingle({ url: args[urlIndex + 1] });
  } else if (listUrlIndex !== -1 && args[listUrlIndex + 1]) {
    await runListIngestion(args[listUrlIndex + 1], isDryRun);
  } else if (args.includes("--batch") || limitIndex !== -1) {
    let limit = 20;
    if (limitIndex !== -1 && args[limitIndex + 1]) {
      const parsedLimit = parseInt(args[limitIndex + 1], 10);
      if (!isNaN(parsedLimit)) limit = parsedLimit;
    }
    await runEnrichmentBatch(limit);
  } else {
    await showInteractiveMenu();
  }
}

main()
  .then(() => {
    setTimeout(() => process.exit(0), 100);
  })
  .catch((err) => {
    console.error("❌ Fatal Execution Error:", err);
    setTimeout(() => process.exit(1), 100);
  });
