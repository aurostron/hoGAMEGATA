import "dotenv/config";
import { initTursoForRequest, libsqlClient } from "../src/lib/turso";
initTursoForRequest(process.env);

async function setupTriggers() {
  console.log("Setting up automatic sync triggers for Game_fts...");

  await libsqlClient.execute(`
    CREATE TRIGGER IF NOT EXISTS game_ai AFTER INSERT ON "Game" 
    WHEN new.status IS NULL OR new.status != 'hidden'
    BEGIN
      INSERT INTO "Game_fts"(id, title, developerNames) 
      VALUES (new.id, new.title, COALESCE(new.developerNames, ''));
    END;
  `);

  await libsqlClient.execute(`
    CREATE TRIGGER IF NOT EXISTS game_ad AFTER DELETE ON "Game" 
    BEGIN
      DELETE FROM "Game_fts" WHERE id = old.id;
    END;
  `);

  await libsqlClient.execute(`
    CREATE TRIGGER IF NOT EXISTS game_au AFTER UPDATE ON "Game" 
    BEGIN
      DELETE FROM "Game_fts" WHERE id = old.id;
      INSERT INTO "Game_fts"(id, title, developerNames) 
      SELECT new.id, new.title, COALESCE(new.developerNames, '')
      WHERE new.status IS NULL OR new.status != 'hidden';
    END;
  `);

  console.log("✅ Auto-sync triggers created successfully!");
}

setupTriggers().catch(console.error);
