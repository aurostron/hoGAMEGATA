import { turso, initTursoForRequest } from "../src/lib/turso";
import { games as gamesTable, genres, tags, platforms, priceSnapshots } from "../src/db/schema";
import { count, desc, sql, and, isNotNull, lte, or, isNull, ne } from "drizzle-orm";
import * as dotenv from "dotenv";
dotenv.config();

initTursoForRequest(process.env);

async function benchmark() {
  console.log("--- Benchmarking queries ---");
  
  // 1. Benchmark tags query from games.astro
  console.time("15k tags query");
  const tagRows = await turso.select({ name: tags.name, slug: tags.slug }).from(tags).orderBy(tags.name);
  console.timeEnd("15k tags query");
  console.log("Fetched tags count:", tagRows.length);

  // 2. Benchmark unoptimized sort=latest
  console.time("Unoptimized sort=latest");
  const rows1 = await turso
    .select({ id: gamesTable.id, title: gamesTable.title, releaseDate: gamesTable.releaseDate })
    .from(gamesTable)
    .where(
      and(
        or(isNull(gamesTable.status), ne(gamesTable.status, "upcoming")),
        or(isNull(gamesTable.releaseDate), lte(gamesTable.releaseDate, new Date()))
      )
    )
    .orderBy(
      sql`CASE WHEN ${gamesTable.releaseDate} IS NOT NULL THEN 0 ELSE 1 END`,
      desc(gamesTable.releaseDate),
      desc(gamesTable.id)
    )
    .limit(24);
  console.timeEnd("Unoptimized sort=latest");
  console.log("Unoptimized results count:", rows1.length);

  // 3. Benchmark optimized sort=latest (with direct releaseDate desc)
  console.time("Optimized sort=latest");
  const rows2 = await turso
    .select({ id: gamesTable.id, title: gamesTable.title, releaseDate: gamesTable.releaseDate })
    .from(gamesTable)
    .where(
      and(
        or(isNull(gamesTable.status), ne(gamesTable.status, "upcoming")),
        isNotNull(gamesTable.releaseDate),
        lte(gamesTable.releaseDate, new Date())
      )
    )
    .orderBy(
      desc(gamesTable.releaseDate),
      desc(gamesTable.id)
    )
    .limit(24);
  console.timeEnd("Optimized sort=latest");
  console.log("Optimized results count:", rows2.length);

  // 4. Benchmark price snapshots max(dealPrice)
  console.time("priceSnapshots max(dealPrice)");
  const [maxPriceRow] = await turso
    .select({ maxPrice: sql<number>`max(${priceSnapshots.dealPrice})` })
    .from(priceSnapshots);
  console.timeEnd("priceSnapshots max(dealPrice)");
  console.log("Max price:", maxPriceRow);
}

benchmark().catch(console.error);
