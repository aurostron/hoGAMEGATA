import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function addCustomItchGame(title: string, itchUrl: string) {
  const cleanSlug = "itch-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  console.log(`Adding entry for "${title}" with slug "${cleanSlug}"...`);

  const game = await prisma.game.upsert({
    where: { slug: cleanSlug },
    update: {
      title,
      status: "released",
      rawgEnriched: false,
    },
    create: {
      title,
      slug: cleanSlug,
      status: "released",
      rawgEnriched: false,
      purchaseLinks: {
        create: {
          storeName: "itch.io",
          url: itchUrl,
        },
      },
    },
  });

  console.log(`✅ Game entry initialized (ID: ${game.id}). Run enrichment to scrape detail data.`);
}

// Check command line arguments for Title and URL
const args = process.argv.slice(2);
const titleArg = args[0];
const urlArg = args[1];

if (!titleArg || !urlArg) {
  console.log("Usage: npx tsx scripts/add-custom-itch.ts \"Game Title\" \"https://author.itch.io/game\"");
  console.log("\nUsing default values for demonstration:");
}

const title = titleArg || "My Custom Game";
const url = urlArg || "https://author-name.itch.io/game-slug";

addCustomItchGame(title, url)
  .then(() => {
    prisma.$disconnect();
    pool.end();
  });
