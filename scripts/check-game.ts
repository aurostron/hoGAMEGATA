import { db } from "../src/lib/db";

async function main() {
  const games = await db.game.findMany({
    where: {
      title: {
        contains: "Resident Evil",
        mode: "insensitive"
      }
    },
    select: {
      id: true,
      title: true,
      category: true,
      slug: true
    },
    orderBy: {
      title: "asc"
    }
  });
  console.log("Resident Evil Games in DB:");
  games.forEach(g => {
    console.log(`- ${g.title}: category = ${g.category}, slug = ${g.slug}`);
  });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
