import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log("Connecting to remote Turso DB:", url);
  const client = createClient({ url: url!, authToken: authToken! });

  const games = await client.execute('SELECT count(*) as cnt FROM "Game"');
  const devs = await client.execute('SELECT count(*) as cnt FROM "Developer"');
  const links = await client.execute('SELECT count(*) as cnt FROM "PurchaseLink"');
  const prices = await client.execute('SELECT count(*) as cnt FROM "PriceSnapshot"');
  const tags = await client.execute('SELECT count(*) as cnt FROM "Tag"');
  const gameTags = await client.execute('SELECT count(*) as cnt FROM "_GameToTag"');

  console.log("\n=== REMOTE TURSO DATABASE VERIFICATION ===");
  console.log("🎮 Games in Game table:", games.rows[0].cnt);
  console.log("👨‍💻 Developers:", devs.rows[0].cnt);
  console.log("🔗 Purchase Links:", links.rows[0].cnt);
  console.log("💰 Price Snapshots:", prices.rows[0].cnt);
  console.log("🏷️ Tags:", tags.rows[0].cnt);
  console.log("🧬 Game-to-Tag Relations:", gameTags.rows[0].cnt);
}

main().catch(console.error);
