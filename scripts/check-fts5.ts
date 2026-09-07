import "dotenv/config";
import { initTursoForRequest, libsqlClient } from "../src/lib/turso";
initTursoForRequest(process.env);

async function checkFTS5() {
  try {
    const res = await libsqlClient.execute("SELECT sqlite_compileoption_used('ENABLE_FTS5') as fts5");
    console.log("FTS5 compile option:", res.rows[0]);

    // Check if any FTS tables already exist
    const tables = await libsqlClient.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%fts5%'");
    console.log("Existing FTS5 tables:", tables.rows);
  } catch (e: any) {
    console.error("FTS5 check error:", e.message);
  }
}

checkFTS5();
