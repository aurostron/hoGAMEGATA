import "./load-env";
import {
  turso,
  schema,
  eq,
  getOrCreateGenre,
  getOrCreatePlatform,
  getOrCreateDeveloper,
  getOrCreatePublisher,
  getOrCreateTag,
  saveGame,
  savePriceSnapshot
} from "./db-helper";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

async function fetchGogDescription(id: string): Promise<string | null> {
  try {
    const url = `https://api.gog.com/products/${id}?expand=description`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const data = await res.json() as any;
      const descHtml = data?.description?.full || data?.description?.lead || "";
      return stripHtml(descHtml);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to fetch description for GOG ID ${id}:`, err);
  }
  return null;
}

const platformSlugMap: Record<string, { name: string; slug: string }> = {
  windows: { name: "PC (Windows)", slug: "win" },
  osx: { name: "Mac", slug: "mac" },
  linux: { name: "Linux", slug: "linux" }
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface SuffixMatch {
  regex: RegExp;
  type: string;
}

const suffixMap: SuffixMatch[] = [
  { regex: /\s*[-–—:]\s*(original\s+soundtrack|soundtrack|ost)\b/i, type: "Soundtrack" },
  { regex: /\s+(original\s+soundtrack|soundtrack|ost)\b/i, type: "Soundtrack" },
  
  { regex: /\s*[-–—:]\s*(digital\s+deluxe\s+edition|deluxe\s+edition|goty\s+edition|game\s+of\s+the\s+year\s+edition|complete\s+edition)\b/i, type: "Deluxe Edition" },
  { regex: /\s+(digital\s+deluxe\s+edition|deluxe\s+edition|goty\s+edition|game\s+of\s+the\s+year\s+edition|complete\s+edition)\b/i, type: "Deluxe Edition" },
  
  { regex: /\s*[-–—:]\s*(deluxe\s+upgrade\s+pack|deluxe\s+upgrade|upgrade\s+pack|skin\s+pack|skin|dlc|add-on|addon|expansion|season\s+pass|pass|upgrade)\b/i, type: "DLC / Add-on" },
  { regex: /\s+(deluxe\s+upgrade\s+pack|deluxe\s+upgrade|upgrade\s+pack|skin\s+pack|skin|dlc|add-on|addon|expansion|season\s+pass|pass|upgrade)\b/i, type: "DLC / Add-on" },
  
  { regex: /\s*[-–—:]\s*(official\s+artbook|artbook|art\s+book|photobook|coloring\s+book|wallpaper\s+pack|wallpapers|artwork|posters|companion|cookbook|official\s+companion|official\s+cookbook)\b/i, type: "Companion Asset" },
  { regex: /\s+(official\s+artbook|artbook|art\s+book|photobook|coloring\s+book|wallpaper\s+pack|wallpapers|artwork|posters|companion|cookbook|official\s+companion|official\s+cookbook)\b/i, type: "Companion Asset" },
  
  { regex: /\s*[-–—:]\s*(demo)\b/i, type: "Demo" },
  { regex: /\s+(demo)\b/i, type: "Demo" }
];

export function extractBaseTitle(title: string): { baseTitle: string; itemType: string | null } {
  for (const item of suffixMap) {
    if (item.regex.test(title)) {
      const baseTitle = title.replace(item.regex, "").trim();
      if (baseTitle.length > 0) {
        return { baseTitle, itemType: item.type };
      }
    }
  }
  return { baseTitle: title, itemType: null };
}


async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const forceUpdate = args.includes("--force-update");

  let targetLimit = 50;
  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(parsedLimit)) {
      targetLimit = parsedLimit;
    }
  }

  let skipDesc = false;
  const skipDescIndex = args.indexOf("--skip-desc");
  if (skipDescIndex !== -1) {
    skipDesc = true;
  }

  console.log(`🚀 Starting GOG Ingestion...`);
  console.log(`🎯 Limit: ${targetLimit} games`);
  console.log(`🔍 Dry Run: ${dryRun ? "YES" : "NO"}`);
  console.log(`⚡ Force Update: ${forceUpdate ? "YES" : "NO"}`);

  const horrorGenreId = await getOrCreateGenre("Horror", "horror");

  let page = 1;
  const pageSize = 50;
  let gamesProcessed = 0;

  while (gamesProcessed < targetLimit) {
    console.log(`\n📡 Fetching page ${page} from GOG Catalog API...`);
    const searchUrl = `https://catalog.gog.com/v1/catalog?limit=${pageSize}&page=${page}&tags=horror&cc=US&lang=en`;
    
    let response;
    try {
      response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
    } catch (fetchErr) {
      console.error("❌ Failed to contact GOG Catalog API:", fetchErr);
      break;
    }

    if (!response.ok) {
      console.error(`❌ GOG API returned error status: ${response.status}`);
      break;
    }

    const data = await response.json() as any;
    const products = data?.products || [];
    if (products.length === 0) {
      console.log("🏁 No more products found in GOG Catalog.");
      break;
    }

    console.log(`📚 Found ${products.length} games on page ${page}. Processing...`);

    for (const g of products) {
      const gogId = String(g.id);
      const title = g.title;
      const slug = g.slug.replace(/_/g, "-");
      const storeLink = g.storeLink || `https://www.gog.com/game/${g.slug}`;

      let displayTitle = title;
      let displaySlug = slug;
      
      const { baseTitle, itemType } = extractBaseTitle(title);
      let storeNameLabel = "GOG";
      if (itemType) {
        storeNameLabel = `GOG (${itemType})`;
      }

      console.log(`\n🎮 Processing GOG game: "${title}" (slug: ${slug})`);

      let existingGame: any = null;
      if (!dryRun) {
        // If it's a companion asset/edition, look up the parent game first
        if (itemType) {
          const parentTitleLower = baseTitle.toLowerCase();
          const parentSlug = slugify(baseTitle);

          const [byParentTitle] = await turso
            .select()
            .from(schema.games)
            .where(eq(schema.games.title, baseTitle))
            .limit(1);

          if (byParentTitle) {
            existingGame = byParentTitle;
          } else {
            const [byParentSlug] = await turso
              .select()
              .from(schema.games)
              .where(eq(schema.games.slug, parentSlug))
              .limit(1);
            if (byParentSlug) {
              existingGame = byParentSlug;
            }
          }

          if (existingGame) {
            console.log(`📎 Found parent game in DB: "${existingGame.title}". Linking GOG (${itemType}) asset.`);
          } else {
            // Parent does not exist. Check if it's a playable edition or non-playable asset
            const isPlayableEdition = itemType === "Deluxe Edition";
            if (!isPlayableEdition) {
              console.log(`⚠️ Skipping GOG companion asset "${title}" - parent game "${baseTitle}" not found in DB.`);
              continue;
            } else {
              // It's a playable deluxe edition: save under base game's clean title and slug
              displayTitle = baseTitle;
              displaySlug = parentSlug;
              console.log(`🏷️ Parent game not found, but it is a playable Deluxe Edition. Ingesting standalone under clean title: "${displayTitle}"`);
            }
          }
        } else {
          // Normal game lookup
          const [bySlug] = await turso
            .select()
            .from(schema.games)
            .where(eq(schema.games.slug, slug))
            .limit(1);
          if (bySlug) {
            existingGame = bySlug;
          } else {
            const [byLink] = await turso
              .select({ gameId: schema.purchaseLinks.gameId })
              .from(schema.purchaseLinks)
              .where(eq(schema.purchaseLinks.url, storeLink))
              .limit(1);
            if (byLink) {
              const [game] = await turso
                .select()
                .from(schema.games)
                .where(eq(schema.games.id, byLink.gameId))
                .limit(1);
              existingGame = game;
            }
          }
        }
      }

      if (existingGame) {
        console.log(`🔗 Game already exists in DB (ID: ${existingGame.id}).`);

        if (dryRun) {
          console.log(`[DRY RUN] Would link GOG store/prices to existing game: ${title}`);
          gamesProcessed++;
          continue;
        }

        // Add GOG purchase link
        const [existingLink] = await turso
          .select()
          .from(schema.purchaseLinks)
          .where(
            eq(schema.purchaseLinks.url, storeLink)
          )
          .limit(1);

        if (!existingLink) {
          console.log(`➕ Adding GOG PurchaseLink to existing game.`);
          await turso.insert(schema.purchaseLinks).values({
            id: crypto.randomUUID(),
            storeName: storeNameLabel,
            url: storeLink,
            gameId: existingGame.id
          });
        }

        // Add/Update PriceSnapshot
        if (g.price) {
          const finalPrice = parseFloat(g.price.finalMoney.amount);
          const basePrice = parseFloat(g.price.baseMoney.amount);
          const discountPercent = parseFloat(g.price.finalMoney.discount || "0");
          const currency = g.price.finalMoney.currency || "USD";

          console.log(`💰 Adding PriceSnapshot: Deal Price = ${finalPrice}, Retail Price = ${basePrice}`);
          await savePriceSnapshot({
            gameId: existingGame.id,
            storeName: storeNameLabel,
            dealPrice: finalPrice,
            retailPrice: basePrice,
            discountPercent,
            dealUrl: storeLink,
            currency,
            country: "US"
          });
        }

        gamesProcessed++;
        continue;
      }

      // Fetch description for new games
      let summary: string | null = null;
      if (!skipDesc) {
        console.log(`📥 Fetching detailed description from GOG API for GOG ID ${gogId}...`);
        summary = await fetchGogDescription(gogId);
        await sleep(1500); // Respect API limit
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would create new game: ${title}`);
        gamesProcessed++;
        continue;
      }

      // Relations: Genres
      const genreIds: string[] = [];
      if (g.genres) {
        for (const gen of g.genres) {
          const genSlug = gen.slug.replace(/_/g, "-");
          const genId = await getOrCreateGenre(gen.name, genSlug);
          genreIds.push(genId);
        }
      }
      if (genreIds.length === 0 && horrorGenreId) {
        genreIds.push(horrorGenreId);
      }

      // Relations: Developers & Publishers
      const developerIds: string[] = [];
      if (g.developers) {
        for (const devName of g.developers) {
          const devSlug = devName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const devId = await getOrCreateDeveloper(devName, devSlug);
          developerIds.push(devId);
        }
      }

      const publisherIds: string[] = [];
      if (g.publishers) {
        for (const pubName of g.publishers) {
          const pubSlug = pubName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const pubId = await getOrCreatePublisher(pubName, pubSlug);
          publisherIds.push(pubId);
        }
      }

      // Relations: Tags
      const tagIds: string[] = [];
      if (g.tags) {
        for (const t of g.tags) {
          const tSlug = t.slug.replace(/_/g, "-");
          const tId = await getOrCreateTag(t.name, tSlug);
          tagIds.push(tId);
        }
      }

      // Platforms mapping
      const platformIds: string[] = [];
      if (g.operatingSystems) {
        for (const os of g.operatingSystems) {
          const mapped = platformSlugMap[os];
          if (mapped) {
            const platId = await getOrCreatePlatform(mapped.name, mapped.slug);
            platformIds.push(platId);
          }
        }
      }

      // Cover URL
      let coverUrl = null;
      if (g.coverHorizontal) {
        coverUrl = g.coverHorizontal.replace("_{formatter}", "");
        if (coverUrl.startsWith("//")) coverUrl = `https:${coverUrl}`;
      } else if (g.coverVertical) {
        coverUrl = g.coverVertical.replace("_{formatter}", "");
        if (coverUrl.startsWith("//")) coverUrl = `https:${coverUrl}`;
      }

      // Screenshots
      const screenshots: string[] = [];
      if (g.screenshots) {
        for (const s of g.screenshots) {
          let sUrl = s.replace("_{formatter}", "");
          if (sUrl.startsWith("//")) sUrl = `https:${sUrl}`;
          screenshots.push(sUrl);
        }
      }

      // Release Date
      let releaseDate: Date | null = null;
      if (g.releaseDate) {
        try {
          const parsed = new Date(g.releaseDate);
          if (!isNaN(parsed.getTime())) releaseDate = parsed;
        } catch {}
      }

      // Denormalized strings
      const developerNames = g.developers?.join(", ") || null;
      const genreNames = g.genres?.map((ge: any) => ge.name).join(", ") || "Horror";
      const platformNames = g.operatingSystems?.map((os: string) => platformSlugMap[os]?.name || os).join(", ") || null;

      // ESRB and PEGI
      let esrbRating: string | null = null;
      let pegiRating: string | null = null;
      if (g.ratings) {
        for (const r of g.ratings) {
          if (r.name === "esrbRating") esrbRating = r.ageRating;
          if (r.name === "pegiRating") pegiRating = r.ageRating;
        }
      }

      console.log(`💾 Saving new game record in DB...`);
      const savedGameId = await saveGame({
        title: displayTitle,
        slug: displaySlug,
        summary,
        coverUrl,
        releaseDate,
        screenshots,
        developerNames,
        genreNames,
        platformNames,
        esrbRating,
        pegiRating,
        source: "gog",
        developerIds,
        publisherIds,
        genreIds,
        tagIds,
        platformIds,
        purchaseLinks: [{ storeName: storeNameLabel, url: storeLink }]
      });

      // Add PriceSnapshot
      if (g.price) {
        const finalPrice = parseFloat(g.price.finalMoney.amount);
        const basePrice = parseFloat(g.price.baseMoney.amount);
        const discountPercent = parseFloat(g.price.finalMoney.discount || "0");
        const currency = g.price.finalMoney.currency || "USD";

        await savePriceSnapshot({
          gameId: savedGameId,
          storeName: storeNameLabel,
          dealPrice: finalPrice,
          retailPrice: basePrice,
          discountPercent,
          dealUrl: storeLink,
          currency,
          country: "US"
        });
      }

      gamesProcessed++;
      if (gamesProcessed >= targetLimit) {
        break;
      }
      
      await sleep(1000);
    }

    page++;
    await sleep(2000);
  }

  console.log(`\n✅ GOG Ingestion completed! Successfully processed ${gamesProcessed} games.`);
}

main().catch((err) => {
  console.error("❌ Fatal Ingestion Error:", err);
  process.exit(1);
});
