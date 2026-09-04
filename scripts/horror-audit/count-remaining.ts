import "../load-env";
import { rawDb } from "./client";

async function main() {
  const r = await rawDb.execute(`SELECT count(id) as c FROM "Game" WHERE "scareRating" IS NULL AND status = 'released'`);
  console.log("Remaining unenriched released games:", r.rows[0].c);
  const total = await rawDb.execute(`SELECT count(id) as c FROM "Game" WHERE status = 'released'`);
  console.log("Total active released games in TursoDB:", total.rows[0].c);
}

main().catch(console.error);
