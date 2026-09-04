import "./load-env";
import { rawDb } from "./dedup-pass2/client";

async function main() {
  const r = await rawDb.execute(`
    SELECT 
      count(*) as total,
      sum(case when "scareRating" is not null and "scareRating" > 0 then 1 else 0 end) as hasScare,
      sum(case when "scareRating" is null or "scareRating" = 0 then 1 else 0 end) as noScare
    FROM "Game"
    WHERE status IS NULL OR status != 'hidden'
  `);
  console.log("Scare Rating Stats:");
  console.log(`Total Active: ${r.rows[0].total}`);
  console.log(`Has Scare Rating (>0): ${r.rows[0].hasScare}`);
  console.log(`No Scare Rating (NULL or 0): ${r.rows[0].noScare}`);
}

main().catch(console.error);
