import "dotenv/config";
import { createClient } from "@libsql/client";

const dbUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log("Connecting to database:", dbUrl);

const client = createClient({
  url: dbUrl,
  authToken: authToken,
});

async function run() {
  const columnsToAdd = [
    { name: "publisherNames", type: "TEXT" },
    { name: "multiplayer", type: "TEXT" },
    { name: "controllerSupport", type: "TEXT" },
    { name: "vrSupport", type: "TEXT" },
  ];

  for (const col of columnsToAdd) {
    try {
      console.log(`Adding column ${col.name} (${col.type}) to Game table...`);
      await client.execute(`ALTER TABLE Game ADD COLUMN ${col.name} ${col.type};`);
      console.log(`Successfully added column ${col.name}`);
    } catch (err: any) {
      if (err.message && err.message.includes("duplicate column name")) {
        console.log(`Column ${col.name} already exists, skipping.`);
      } else {
        console.error(`Error adding column ${col.name}:`, err.message || err);
      }
    }
  }

  const info = await client.execute("PRAGMA table_info(Game);");
  const columnNames = info.rows.map((r: any) => r.name);
  console.log("\nVerified columns on Game table:");
  console.log(columnNames.filter((name: string) => ["publisherNames", "multiplayer", "controllerSupport", "vrSupport", "releaseDate", "scareProfile"].includes(name)));
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
