import "dotenv/config";
import { turso } from "./src/lib/turso";
import { games as gamesTable, priceSnapshots as priceSnapshotsTable } from "./src/db/schema";
import { sql, eq } from "drizzle-orm";

async function main() {
  const baseQuery = turso
    .select({ game: gamesTable })
    .from(gamesTable)
    .leftJoin(priceSnapshotsTable, eq(priceSnapshotsTable.gameId, gamesTable.id))
    .groupBy(gamesTable.id)
    .orderBy(
      sql`CASE WHEN min(${priceSnapshotsTable.dealPrice}) IS NULL THEN 1 ELSE 0 END`,
      sql`min(${priceSnapshotsTable.dealPrice}) ASC`
    )
    .limit(3);
  
  const result = await baseQuery;
  console.log(result.map(r => r.game.title));
}

main().catch(console.error);
