import { turso, schema, eq, like, or } from "./db-helper";

const searchTerms = [
  "Ellie Edition",
  "Nightmare Edition",
  "Collector's Edition",
  "Triple Pack",
];

async function main() {
  console.log("Searching for exact games...");
  for (const term of searchTerms) {
    const rows = await turso
      .select({ id: schema.games.id, slug: schema.games.slug, title: schema.games.title })
      .from(schema.games)
      .where(like(schema.games.title, `%${term}%`))
      .limit(10);
    console.log(`Term: "${term}"`);
    for (const r of rows) {
      console.log(`  - Match: ${r.title} | Slug: ${r.slug} | ID: ${r.id}`);
    }
  }
}

main();
