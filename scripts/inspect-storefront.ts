import "dotenv/config";
import { getSupabaseServer } from "../src/lib/supabaseServer";

async function main() {
  const supabase = getSupabaseServer();
  const gameSummarySelect = "id, title, slug, status, coverUrl, isTrending, rating, category, esrbRating, pegiRating, developerNames, genreNames, platformNames, releaseDate, rawgEnriched, screenshots";
  
  const now = new Date().toISOString();
  
  const [latestRes, trendingRes, upcomingRes, topRatedRes] = await Promise.all([
    supabase
      .from("Game")
      .select(gameSummarySelect)
      .order("releaseDate", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("Game")
      .select(gameSummarySelect)
      .order("isTrending", { ascending: false })
      .order("popularity", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("Game")
      .select(gameSummarySelect)
      .or(`status.eq.upcoming,releaseDate.gt.${now}`)
      .order("releaseDate", { ascending: true, nullsFirst: true })
      .limit(5),
    supabase
      .from("Game")
      .select(gameSummarySelect)
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(5)
  ]);

  console.log("--- LATEST ---");
  latestRes.data?.forEach(g => console.log(`- ${g.title}: cover: ${g.coverUrl}, screenshots: ${g.screenshots ? JSON.stringify(g.screenshots) : null}`));

  console.log("--- TRENDING ---");
  trendingRes.data?.forEach(g => console.log(`- ${g.title}: cover: ${g.coverUrl}, screenshots: ${g.screenshots ? JSON.stringify(g.screenshots) : null}`));

  console.log("--- UPCOMING ---");
  upcomingRes.data?.forEach(g => console.log(`- ${g.title}: cover: ${g.coverUrl}, screenshots: ${g.screenshots ? JSON.stringify(g.screenshots) : null}`));

  console.log("--- TOP RATED ---");
  topRatedRes.data?.forEach(g => console.log(`- ${g.title}: cover: ${g.coverUrl}, screenshots: ${g.screenshots ? JSON.stringify(g.screenshots) : null}`));
}

main().catch(console.error);
