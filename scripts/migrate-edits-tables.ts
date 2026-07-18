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
  console.log("Creating EditSuggestion table if not exists...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS EditSuggestion (
      id TEXT PRIMARY KEY,
      trackingId TEXT,
      gameId TEXT NOT NULL,
      userId TEXT,
      userIp TEXT,
      field TEXT NOT NULL,
      oldValue TEXT,
      newValue TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      aiStatus TEXT DEFAULT 'pending',
      aiConfidence REAL,
      aiReasoning TEXT,
      reviewedBy TEXT,
      reviewedAt INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  try {
    await client.execute("ALTER TABLE EditSuggestion ADD COLUMN trackingId TEXT;");
  } catch (e) {
    // Column may already exist
  }

  await client.execute(`
    CREATE INDEX IF NOT EXISTS edit_suggestion_game_idx ON EditSuggestion(gameId);
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS edit_suggestion_status_idx ON EditSuggestion(status);
  `);

  console.log("Creating GameRevision table if not exists...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS GameRevision (
      id TEXT PRIMARY KEY,
      gameId TEXT NOT NULL,
      suggestionId TEXT,
      editedBy TEXT,
      changesJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS game_revision_game_idx ON GameRevision(gameId);
  `);

  console.log("Creating UserReputation table if not exists...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS UserReputation (
      userId TEXT PRIMARY KEY,
      totalSubmitted INTEGER NOT NULL DEFAULT 0,
      totalApproved INTEGER NOT NULL DEFAULT 0,
      totalRejected INTEGER NOT NULL DEFAULT 0,
      accuracyScore REAL NOT NULL DEFAULT 1.0,
      tier TEXT NOT NULL DEFAULT 'tier_0_new',
      badgesJson TEXT NOT NULL DEFAULT '[]',
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS user_reputation_tier_idx ON UserReputation(tier);
  `);

  console.log("✅ Edit tables successfully migrated and ready!");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
