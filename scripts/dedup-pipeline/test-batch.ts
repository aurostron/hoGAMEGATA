import { rawDb } from "./client";

async function test() {
  const res = await rawDb.batch([
    { sql: "SELECT 1 as val", args: [] },
    { sql: "SELECT 2 as val", args: [] }
  ]);
  console.log("Batch execution supported! Result:", res.map(r => r.rows));
}

test().catch(console.error);
