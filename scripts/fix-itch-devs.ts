import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixItchDevelopers() {
  console.log("🔍 Fetching all itch.io games from the database...");

  const games = await prisma.game.findMany({
    where: {
      slug: { startsWith: "itch-" }
    },
    include: {
      purchaseLinks: {
        where: { storeName: "itch.io" }
      },
      developers: true
    }
  });

  console.log(`📚 Found ${games.length} itch.io games. Scanning for missing developers...`);
  let fixedCount = 0;

  for (const game of games) {
    // Check if we need to fix it (no developer names string OR empty developers array)
    const hasDevNames = game.developerNames && game.developerNames.trim() !== "";
    const hasDevRelation = game.developers && game.developers.length > 0;

    if (!hasDevNames || !hasDevRelation) {
      const itchLink = game.purchaseLinks[0]?.url;
      if (!itchLink) {
        console.warn(`  ⚠️ Game "${game.title}" has no itch.io purchase link. Skipping.`);
        continue;
      }

      // Extract username from subdomain of link (e.g. https://author.itch.io/game)
      const match = itchLink.match(/https?:\/\/([^.]+)\.itch\.io/);
      if (match) {
        let extractedDevName = match[1];
        
        // Capitalize developer name nicely (replace dashes with spaces and title case)
        const formattedDevName = extractedDevName
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const devSlug = extractedDevName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        console.log(`🔨 Fixing "${game.title}":`);
        console.log(`  Extracted username: "${extractedDevName}" -> Formatted: "${formattedDevName}"`);

        // Create or get developer
        const dbDev = await prisma.developer.upsert({
          where: { slug: devSlug },
          update: { name: formattedDevName },
          create: { name: formattedDevName, slug: devSlug }
        });

        // Update game record
        await prisma.game.update({
          where: { id: game.id },
          data: {
            developerNames: formattedDevName,
            developers: {
              connect: { id: dbDev.id }
            }
          }
        });

        fixedCount++;
      } else {
        console.warn(`  ⚠️ Could not parse itch.io username from link "${itchLink}" for game "${game.title}".`);
      }
    }
  }

  console.log(`\n🎉 Backfill complete! Fixed developer references for ${fixedCount} games.`);
}

fixItchDevelopers()
  .then(() => {
    prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Fix Error:", err);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
