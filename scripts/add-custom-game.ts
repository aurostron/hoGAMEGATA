import "./load-env";
import * as fs from "fs";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { MOODS, getMoodTagsForGame } from "./mood-rules";
import { lazyGetPrices } from "../src/lib/priceEngine";
import {
  turso,
  schema,
  eq,
  or,
  inArray,
  getOrCreateGenre,
  getOrCreatePlatform,
  getOrCreateDeveloper,
  getOrCreatePublisher,
  getOrCreateTag,
  saveGame,
  sql
} from "./db-helper";

interface IGDBGame {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  total_rating?: number;
  follows?: number;
  cover?: { url: string };
  screenshots?: Array<{ url: string }>;
  videos?: Array<{ video_id: string }>;
  involved_companies?: Array<{
    developer: boolean;
    publisher: boolean;
    company: { name: string; slug: string };
  }>;
  platforms?: Array<{ name: string; slug: string }>;
  genres?: Array<{ id: number; name: string; slug: string }>;
  keywords?: Array<{ id: number; name: string; slug: string }>;
  player_perspectives?: Array<{ id: number; name: string; slug: string }>;
  websites?: Array<{ url: string; category: number }>;
  category?: number;
}

async function getTwitchToken(twitchId: string, twitchSecret: string): Promise<string> {
  const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`, {
    method: "POST"
  });
  
  if (!tokenResponse.ok) {
    throw new Error(`Twitch OAuth failed: ${tokenResponse.statusText}`);
  }

  const { access_token } = await tokenResponse.json() as { access_token: string };
  return access_token;
}

async function main() {
  const twitchId = process.env.TWITCH_CLIENT_ID;
  const twitchSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!twitchId || !twitchSecret) {
    console.error("❌ Error: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET missing in .env.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let slugArg: string | null = null;
  let idArg: string | null = null;

  const slugIdx = args.indexOf("--slug");
  if (slugIdx !== -1 && args[slugIdx + 1]) {
    slugArg = args[slugIdx + 1].trim();
  }

  const idIdx = args.indexOf("--id");
  if (idIdx !== -1 && args[idIdx + 1]) {
    idArg = args[idIdx + 1].trim();
  }

  const isInteractive = !slugArg && !idArg;
  let searchQuery = "";
  
  const rl = isInteractive ? readline.createInterface({ input, output }) : null;

  try {
    const access_token = await getTwitchToken(twitchId, twitchSecret);
    
    if (isInteractive && rl) {
      searchQuery = await rl.question("🔍 Enter game title to search on IGDB: ");
      if (!searchQuery.trim()) {
        console.log("❌ Search query cannot be empty.");
        process.exit(0);
      }
    }

    let query = "";
    if (idArg) {
      console.log(`📡 Querying IGDB by ID: ${idArg}...`);
      query = `
        fields name, slug, summary, storyline, first_release_date, total_rating, follows,
          cover.url, screenshots.url, videos.video_id,
          involved_companies.developer, involved_companies.publisher, involved_companies.company.name, involved_companies.company.slug,
          platforms.name, platforms.slug, genres.name, genres.slug,
          keywords.name, keywords.slug, player_perspectives.name, player_perspectives.slug,
          websites.url, websites.category, category;
        where id = ${idArg};
      `;
    } else if (slugArg) {
      console.log(`📡 Querying IGDB by slug: "${slugArg}"...`);
      query = `
        fields name, slug, summary, storyline, first_release_date, total_rating, follows,
          cover.url, screenshots.url, videos.video_id,
          involved_companies.developer, involved_companies.publisher, involved_companies.company.name, involved_companies.company.slug,
          platforms.name, platforms.slug, genres.name, genres.slug,
          keywords.name, keywords.slug, player_perspectives.name, player_perspectives.slug,
          websites.url, websites.category, category;
        where slug = "${slugArg}";
      `;
    } else {
      console.log(`📡 Querying IGDB search results for: "${searchQuery}"...`);
      query = `
        fields name, slug, summary, storyline, first_release_date, total_rating, follows,
          cover.url, screenshots.url, videos.video_id,
          involved_companies.developer, involved_companies.publisher, involved_companies.company.name, involved_companies.company.slug,
          platforms.name, platforms.slug, genres.name, genres.slug,
          keywords.name, keywords.slug, player_perspectives.name, player_perspectives.slug,
          websites.url, websites.category, category;
        search "${searchQuery}";
        limit 10;
      `;
    }

    const igdbResponse = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": twitchId,
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "text/plain"
      },
      body: query
    });

    if (!igdbResponse.ok) {
      const errorText = await igdbResponse.text();
      throw new Error(`IGDB request failed: ${igdbResponse.statusText} (${errorText})`);
    }

    const results = await igdbResponse.json() as IGDBGame[];
    
    if (!results || results.length === 0) {
      console.log("❌ No matching games found on IGDB.");
      process.exit(0);
    }

    let selectedGames: IGDBGame[] = [];
    if (isInteractive && rl) {
      console.log("\n🔎 Select a game to import:");
      results.forEach((game, idx) => {
        const year = game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : "N/A";
        console.log(`${idx + 1}. ${game.name} (${year}) - IGDB ID: ${game.id} (slug: ${game.slug})`);
      });

      const selection = await rl.question(`\nEnter selection [1-${results.length}]: `);
      const idx = parseInt(selection.trim(), 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= results.length) {
        console.log("❌ Invalid selection.");
        process.exit(0);
      }
      selectedGames = [results[idx]];
    } else {
      selectedGames = [results[0]];
    }

    const horrorGenreId = await getOrCreateGenre("Horror", "horror");

    console.log("🏷️ Pre-upserting curated Mood Tags...");
    const moodTagMap = new Map<string, string>();
    for (const mood of MOODS) {
      const tagId = await getOrCreateTag(mood.name, mood.slug);
      moodTagMap.set(mood.slug, tagId);
    }

    for (let i = 0; i < selectedGames.length; i++) {
      const selectedGame = selectedGames[i];
      const slug = selectedGame.slug || selectedGame.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      console.log(`\n📥 Ingesting: "${selectedGame.name}"...`);

      const releaseDate = selectedGame.first_release_date ? new Date(selectedGame.first_release_date * 1000) : null;
      const rating = selectedGame.total_rating || null;
      const popularity = selectedGame.follows || null;
      const status = releaseDate && releaseDate > new Date() ? "upcoming" : "released";

      let coverUrl = selectedGame.cover?.url || null;
      if (coverUrl && coverUrl.startsWith("//")) {
        coverUrl = `https:${coverUrl}`;
      }
      if (coverUrl) {
        coverUrl = coverUrl.replace("t_thumb", "t_cover_big");
      }

      const screenshots: string[] = [];
      if (selectedGame.screenshots) {
        for (const s of selectedGame.screenshots) {
          let sUrl = s.url;
          if (sUrl.startsWith("//")) {
            sUrl = `https:${sUrl}`;
          }
          screenshots.push(sUrl.replace("t_thumb", "t_screenshot_huge"));
        }
      }

      let trailerUrl = null;
      if (selectedGame.videos && selectedGame.videos.length > 0) {
        trailerUrl = `https://www.youtube.com/embed/${selectedGame.videos[0].video_id}`;
      }

      const developerIds: string[] = [];
      const publisherIds: string[] = [];
      if (selectedGame.involved_companies) {
        for (const ic of selectedGame.involved_companies) {
          if (!ic.company) continue;
          const compName = ic.company.name;
          const compSlug = ic.company.slug || compName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          if (ic.developer) {
            const devId = await getOrCreateDeveloper(compName, compSlug);
            developerIds.push(devId);
          }
          if (ic.publisher) {
            const pubId = await getOrCreatePublisher(compName, compSlug);
            publisherIds.push(pubId);
          }
        }
      }

      const platformIds: string[] = [];
      if (selectedGame.platforms) {
        for (const p of selectedGame.platforms) {
          const platSlug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const platId = await getOrCreatePlatform(p.name, platSlug);
          platformIds.push(platId);
        }
      }

      const gameGenreIds: string[] = [];
      if (selectedGame.genres) {
        for (const gen of selectedGame.genres) {
          const genSlug = gen.slug || gen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const genreId = await getOrCreateGenre(gen.name, genSlug, gen.id);
          gameGenreIds.push(genreId);
        }
      }
      if (!gameGenreIds.includes(horrorGenreId)) {
        gameGenreIds.push(horrorGenreId);
      }

      const tagIds: string[] = [];
      const matchedMoods = await getMoodTagsForGame({
        title: selectedGame.name,
        summary: selectedGame.summary || "",
        storyline: selectedGame.storyline || "",
        genreNames: selectedGame.genres?.map(gen => gen.name) || [],
        keywords: selectedGame.keywords?.map(kw => kw.name) || [],
        playerPerspectives: selectedGame.player_perspectives?.map(pp => pp.name) || []
      });

      for (const moodSlug of matchedMoods) {
        const tId = moodTagMap.get(moodSlug);
        if (tId) tagIds.push(tId);
      }

      const developerNames = Array.from(new Set(
        selectedGame.involved_companies?.filter(ic => ic.developer).map(ic => ic.company.name) || []
      )).join(", ");

      const genreNames = Array.from(new Set([
        "Horror",
        ...(selectedGame.genres?.map(gen => gen.name) || [])
      ])).join(", ");

      const platformNames = Array.from(new Set(
        selectedGame.platforms?.map(p => p.name) || []
      )).join(", ");

      const purchaseLinks: Array<{ storeName: string; url: string }> = [];
      if (selectedGame.websites) {
        for (const web of selectedGame.websites) {
          const url = web.url;
          let storeName = "";
          if (web.category === 13) {
            storeName = "Steam";
          } else if (web.category === 14) {
            storeName = "GOG";
          } else if (web.category === 16) {
            storeName = "Epic Games Store";
          } else if (web.category === 17) {
            storeName = "Itch.io";
          } else if (web.category === 10) {
            storeName = "Android Google Play";
          } else if (web.category === 11) {
            storeName = "iOS App Store";
          } else if (web.category === 23) {
            storeName = "PlayStation Store";
          } else if (web.category === 31) {
            storeName = "Nintendo eShop";
          } else if (web.category === 1) {
            storeName = "Official Website";
          }

          if (storeName) {
            purchaseLinks.push({ storeName, url });
          }
        }
      }

      const savedGameId = await saveGame({
        igdbId: selectedGame.id,
        title: selectedGame.name,
        slug,
        summary: selectedGame.summary || null,
        storyline: selectedGame.storyline || null,
        releaseDate,
        status,
        coverUrl,
        rating,
        popularity,
        developerNames: developerNames || null,
        genreNames: genreNames || null,
        platformNames: platformNames || null,
        trailerUrl,
        screenshots,
        category: selectedGame.category !== undefined ? selectedGame.category : null,
        developerIds,
        publisherIds,
        genreIds: gameGenreIds,
        platformIds,
        tagIds,
        purchaseLinks
      });

      console.log("🏷️ Fetching and caching live storefront prices...");
      try {
        const prices = await lazyGetPrices(savedGameId, selectedGame.name, purchaseLinks, "US", true);
        console.log(`✅ Cached ${prices.length} prices for region US!`);
      } catch (priceErr) {
        console.error("❌ Failed to cache prices:", priceErr);
      }

      console.log(`\n🎉 [${i + 1}/${selectedGames.length}] Ingestion complete! Game "${selectedGame.name}" successfully imported.`);
      console.log(`🔗 Local URL: http://localhost:4321/game/${slug}`);
      console.log(`🔗 Production URL: https://gamegata.xyz/game/${slug}`);
    }

  } catch (error) {
    console.error("❌ Error during custom game ingestion execution:", error);
  } finally {
    if (rl) rl.close();
  }
}

main().catch(console.error);
