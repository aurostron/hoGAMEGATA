import "dotenv/config";
import { createClient } from "@libsql/client";

const dbUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log("Connecting to database:", dbUrl);

const client = createClient({
  url: dbUrl,
  authToken: authToken,
});

async function migrate() {
  console.log("Adding likesCount column to Game table if not exists...");
  try {
    await client.execute(`ALTER TABLE Game ADD COLUMN likesCount INTEGER DEFAULT 0 NOT NULL;`);
    console.log("✅ Added likesCount column successfully!");
  } catch (e: any) {
    if (e.message?.includes("duplicate column name") || e.message?.includes("already exists")) {
      console.log("ℹ️ likesCount column already exists.");
    } else {
      console.warn("Notice during column alter:", e.message || e);
    }
  }

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS game_likes_count_idx ON Game(likesCount);`);
    console.log("✅ Created game_likes_count_idx index successfully!");
  } catch (e: any) {
    console.warn("Notice during index create:", e.message || e);
  }

  console.log("🎉 Likes column migration finished!");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
