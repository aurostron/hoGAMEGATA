import { turso, schema, or, like } from "./db-helper";

const titles = [
  "The Last of Us Part II: Ellie Edition",
  "Dead by Daylight: Nightmare Edition",
  "Robot Daycare",
  "Resident Evil 3: Collector's Edition",
  "Defrag",
  "Apophis",
  "Gears of War: Triple Pack",
  "Like Gulls Crying at the Dawn",
  "Salt and Sanctuary: Drowned Tome Edition",
  "Sad Satan"
];

async function main() {
  console.log("Searching for games...");
  for (const t of titles) {
    const rows = await turso
      .select({ id: schema.games.id, slug: schema.games.slug, title: schema.games.title })
      .from(schema.games)
      .where(like(schema.games.title, `%${t.split(":")[0]}%`))
      .limit(3);
    console.log(`Query: "${t}"`);
    for (const r of rows) {
      console.log(`  - Match: ${r.title} | Slug: ${r.slug} | ID: ${r.id}`);
    }
  }
}

main();
