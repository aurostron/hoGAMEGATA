import * as dotenv from "dotenv";
dotenv.config();

import { turso, schema, count, eq, like, isNotNull } from "./db-helper";

async function main() {
  const [totalRes] = await turso.select({ value: count() }).from(schema.games);
  const total = totalRes.value;

  const [enrichedRes] = await turso.select({ value: count() }).from(schema.games).where(eq(schema.games.rawgEnriched, true));
  const enriched = enrichedRes.value;

  const [unenrichedRes] = await turso.select({ value: count() }).from(schema.games).where(eq(schema.games.rawgEnriched, false));
  const unenriched = unenrichedRes.value;
  
  // Count by source / prefix
  const [itchGamesRes] = await turso.select({ value: count() }).from(schema.games).where(like(schema.games.slug, "itch-%"));
  const itchGames = itchGamesRes.value;

  const [igdbGamesRes] = await turso.select({ value: count() }).from(schema.games).where(isNotNull(schema.games.igdbId));
  const igdbGames = igdbGamesRes.value;

  const [gogGamesRes] = await turso.select({ value: count() }).from(schema.games).where(eq(schema.games.source, "gog"));
  const gogGames = gogGamesRes.value;

  const [steamGamesRes] = await turso.select({ value: count() }).from(schema.games).where(eq(schema.games.source, "steam"));
  const steamGames = steamGamesRes.value;

  const [retroGamesRes] = await turso.select({ value: count() }).from(schema.games).where(eq(schema.games.source, "archive.org"));
  const retroGames = retroGamesRes.value;

  // Fetch IGDB API Counts for comparison
  let igdbTotalReleased = 0;
  let igdbTotalUpcoming = 0;
  let hasIgdbStats = false;

  const twitchId = process.env.TWITCH_CLIENT_ID;
  const twitchSecret = process.env.TWITCH_CLIENT_SECRET;

  if (twitchId && twitchSecret) {
    try {
      const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`, {
        method: "POST"
      });
      if (tokenResponse.ok) {
        const { access_token } = await tokenResponse.json() as { access_token: string };

        // 1. Released count
        const releasedRes = await fetch("https://api.igdb.com/v4/games/count", {
          method: "POST",
          headers: {
            "Client-ID": twitchId,
            "Authorization": `Bearer ${access_token}`,
            "Content-Type": "text/plain"
          },
          body: `where themes = (19) & first_release_date != null & cover != null;`
        });
        if (releasedRes.ok) {
          const { count: countVal } = await releasedRes.json() as { count: number };
          igdbTotalReleased = countVal;
        }

        // 2. Upcoming count
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const upcomingRes = await fetch("https://api.igdb.com/v4/games/count", {
          method: "POST",
          headers: {
            "Client-ID": twitchId,
            "Authorization": `Bearer ${access_token}`,
            "Content-Type": "text/plain"
          },
          body: `where themes = (19) & first_release_date > ${currentTimestamp} & cover != null;`
        });
        if (upcomingRes.ok) {
          const { count: countVal } = await upcomingRes.json() as { count: number };
          igdbTotalUpcoming = countVal;
        }

        hasIgdbStats = true;
      }
    } catch (e) {
      // Fail silently, fall back to local stats only
    }
  }

  console.log("\n==================================================");
  console.log("📊 DATABASE STATISTICS (hoGAMEGATA)");
  console.log("==================================================");
  console.log(`📈 Total Local Games: ${total.toLocaleString()}`);
  console.log(`⭐ Enriched Games:    ${enriched.toLocaleString()}`);
  console.log(`⏳ Unenriched Games:  ${unenriched.toLocaleString()}`);
  console.log("--------------------------------------------------");
  console.log(`🎮 Itch.io Games:     ${itchGames.toLocaleString()}`);
  console.log(`📥 IGDB Local Games:  ${igdbGames.toLocaleString()}`);
  console.log(`💽 GOG Games:         ${gogGames.toLocaleString()}`);
  console.log(`♨️ Steam Games:       ${steamGames.toLocaleString()}`);
  console.log(`📜 Retro Games:       ${retroGames.toLocaleString()}`);
  if (hasIgdbStats) {
    console.log("--------------------------------------------------");
    console.log(`🌐 IGDB Catalog released: ${igdbTotalReleased.toLocaleString()}`);
    console.log(`🌐 IGDB Catalog upcoming: ${igdbTotalUpcoming.toLocaleString()}`);
    const remaining = (igdbTotalReleased + igdbTotalUpcoming) - igdbGames;
    console.log(`📥 IGDB Games yet to import: ${remaining > 0 ? remaining.toLocaleString() : 0}`);
  }
  console.log("==================================================\n");
}

main()
  .catch(console.error);
