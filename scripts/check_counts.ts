import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const c = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });

  const total = await c.execute("SELECT count(*) as c FROM Game");
  console.log("Total games:", total.rows[0].c);

  const withRelease = await c.execute("SELECT count(*) as c FROM Game WHERE releaseDate <= strftime('%s', 'now') * 1000");
  console.log("Games with releaseDate <= now:", withRelease.rows[0].c);

  const nullRelease = await c.execute("SELECT count(*) as c FROM Game WHERE releaseDate IS NULL");
  console.log("Games with releaseDate IS NULL:", nullRelease.rows[0].c);

  const combined = await c.execute("SELECT count(*) as c FROM Game WHERE (releaseDate IS NULL OR releaseDate <= strftime('%s', 'now') * 1000) AND (status IS NULL OR status != 'upcoming') AND (status IS NULL OR status != 'hidden')");
  console.log("Total non-upcoming, non-hidden games (including NULL releaseDate):", combined.rows[0].c);
}

main().catch(console.error);
