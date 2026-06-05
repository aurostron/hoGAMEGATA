import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { db as prisma } from '@/lib/db';

const parser = new Parser();

export async function GET() {
  try {
    const feedsToFetch = [
      'https://itch.io/games/tag-horror.xml',
      'https://itch.io/games/tag-thriller.xml'
    ];
    
    let ingestedCount = 0;
    
    for (const feedUrl of feedsToFetch) {
      const feed = await parser.parseURL(feedUrl);
      
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;
        const itemLink: string = item.link;
        
        // Example link: https://username.itch.io/game-slug
        const urlParts = itemLink.split('/');
        const rawSlug = urlParts[urlParts.length - 1];
        const slug = `itch-${rawSlug}`; // Prefixing to avoid collision with IGDB/RAWG slugs
        
        // Build the Game data
        const gameData = {
          title: item.title,
          slug: slug,
          summary: item.contentSnippet || null,
          releaseDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          status: "released",
          // Extract basic cover from HTML content if possible (simple regex)
          coverUrl: item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || null,
        };

        // Upsert the game
        const game = await prisma.game.upsert({
          where: { slug },
          update: gameData,
          create: gameData,
        });

        // Upsert the purchase link specifically for itch.io
        await prisma.purchaseLink.upsert({
          where: {
            id: `itch-link-${game.id}`, // We'll just try to find it, but upsert doesn't let us search by non-unique easily if no unique constraint exists
          },
          update: {
            url: itemLink
          },
          create: {
            storeName: 'itch.io',
            url: itemLink,
            gameId: game.id
          }
        }).catch(async (e) => {
           const existingLink = await prisma.purchaseLink.findFirst({
             where: { gameId: game.id, storeName: 'itch.io' }
           });
           
           if (existingLink) {
             await prisma.purchaseLink.update({
               where: { id: existingLink.id },
               data: { url: itemLink }
             });
           } else {
             await prisma.purchaseLink.create({
               data: {
                 storeName: 'itch.io',
                 url: itemLink,
                 gameId: game.id
               }
             });
           }
        });
        
        ingestedCount++;
      }
    }

    return NextResponse.json({ success: true, ingestedCount });
  } catch (error) {
    console.error("Error ingesting itch.io RSS:", error);
    return NextResponse.json({ success: false, error: "Failed to ingest RSS feed" }, { status: 500 });
  }
}
