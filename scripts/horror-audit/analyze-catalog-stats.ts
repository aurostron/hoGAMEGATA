import "../load-env";
import { rawDb } from "./client";

async function main() {
  const total = await rawDb.execute("SELECT count(*) as c FROM Game WHERE status IS NULL OR status != 'hidden'");
  const hidden = await rawDb.execute("SELECT count(*) as c FROM Game WHERE status = 'hidden'");
  const devs = await rawDb.execute("SELECT count(*) as c FROM Developer");
  const pubs = await rawDb.execute("SELECT count(*) as c FROM Publisher");
  const tags = await rawDb.execute("SELECT count(*) as c FROM Tag");
  const igdb = await rawDb.execute("SELECT count(*) as c FROM Game WHERE (status IS NULL OR status != 'hidden') AND igdbId IS NOT NULL");
  const rated = await rawDb.execute("SELECT count(*) as c FROM Game WHERE (status IS NULL OR status != 'hidden') AND rating IS NOT NULL");
  const scare = await rawDb.execute("SELECT count(*) as c FROM Game WHERE (status IS NULL OR status != 'hidden') AND scareRating IS NOT NULL");

  console.log("=== TURSO CATALOG ACCURATE STATS ===");
  console.log("Active Games (not hidden): ", total.rows[0].c);
  console.log("Hidden Games (soft-hidden):", hidden.rows[0].c);
  console.log("Total Developers:          ", devs.rows[0].c);
  console.log("Total Publishers:          ", pubs.rows[0].c);
  console.log("Total Tags:                ", tags.rows[0].c);
  console.log("IGDB Linked Games:         ", igdb.rows[0].c);
  const sources = await rawDb.execute("SELECT source, count(*) as c FROM Game WHERE status IS NULL OR status != 'hidden' GROUP BY source");
  console.log("Sources breakdown:", sources.rows);
}


main().catch(console.error);

