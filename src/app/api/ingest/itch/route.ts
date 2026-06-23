import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getSupabaseServer } from '@/lib/supabaseServer';

const parser = new Parser();

export async function GET() {
  try {
    const feedsToFetch = [
      'https://itch.io/games/tag-horror.xml',
      'https://itch.io/games/tag-thriller.xml'
    ];
    
    const supabase = getSupabaseServer();
    let ingestedCount = 0;
    
    for (const feedUrl of feedsToFetch) {
      const feed = await parser.parseURL(feedUrl);
      
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;
        const itemLink: string = item.link;
        
        const urlParts = itemLink.split('/');
        const rawSlug = urlParts[urlParts.length - 1];
        const slug = `itch-${rawSlug}`;
        
        const gameData = {
          title: item.title,
          slug: slug,
          summary: item.contentSnippet || null,
          releaseDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          status: "released",
          coverUrl: item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || null,
        };

        // Upsert game
        const { data: game, error: gameError } = await supabase
          .from("Game")
          .upsert(gameData, { onConflict: "slug" })
          .select("id")
          .single();

        if (gameError || !game) continue;

        // Upsert purchase link
        const { data: existingLink } = await supabase
          .from("PurchaseLink")
          .select("id")
          .eq("gameId", game.id)
          .eq("storeName", "itch.io")
          .limit(1)
          .maybeSingle();

        if (existingLink) {
          await supabase
            .from("PurchaseLink")
            .update({ url: itemLink })
            .eq("id", existingLink.id);
        } else {
          await supabase
            .from("PurchaseLink")
            .insert({
              storeName: "itch.io",
              url: itemLink,
              gameId: game.id,
            });
        }
        
        ingestedCount++;
      }
    }

    return NextResponse.json({ success: true, ingestedCount });
  } catch (error) {
    console.error("Error ingesting itch.io RSS:", error);
    return NextResponse.json({ success: false, error: "Failed to ingest RSS feed" }, { status: 500 });
  }
}
