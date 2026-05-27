import { db } from "../src/lib/db";

const DLC_KEYWORDS = [
  "dlc",
  "expansion",
  "season pass",
  "banned footage",
  "end of zoe",
  "not a hero",
  "shadows of rose",
  "separate ways",
  "lost in nightmares",
  "desperate escape",
  "ghost survivors",
  "addon",
  "add-on",
  "extra episode",
  "whistleblower",
  "left behind"
];

async function main() {
  const games = await db.game.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      slug: true
    }
  });

  const matches = games.filter(g => {
    const titleLower = g.title.toLowerCase();
    return DLC_KEYWORDS.some(kw => titleLower.includes(kw));
  });

  console.log(`Found ${matches.length} potential DLC games:`);
  matches.forEach(g => {
    console.log(`- ${g.title} (slug: ${g.slug}, current category: ${g.category})`);
  });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
