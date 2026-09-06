import http from "node:http";
import path from "node:path";
import fs from "node:fs";

let bridgeServer: http.Server | null = null;

export async function ensureLocalDbBridge() {
  if (process.env.TURSO_DATABASE_URL) return;
  if (bridgeServer) return;

  const dbPath = path.resolve(process.cwd(), "local.db");
  if (!fs.existsSync(dbPath)) {
    const jsonPath = path.resolve(process.cwd(), "data", "curated-100-games.json");
    if (fs.existsSync(jsonPath)) {
      console.log("[local-db-bridge] local.db not found. Auto-generating from data/curated-100-games.json...");
      try {
        const { execSync } = await import("node:child_process");
        execSync("npx tsx scripts/seed-mock-db.ts", { stdio: "inherit" });
      } catch (err) {
        console.error("[local-db-bridge] Failed to auto-seed local.db:", err);
      }
    }
  }

  if (!fs.existsSync(dbPath)) {
    console.warn("[local-db-bridge] local.db not found. Run 'npm run setup:mock' to create it.");
    return;
  }

  try {
    const { createClient } = await import("@libsql/client");
    const localClient = createClient({ url: `file:${dbPath}` });

    bridgeServer = http.createServer(async (req, res) => {
      if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
          try {
            if (req.url === "/query") {
              const stmt = JSON.parse(body);
              const result = await localClient.execute(stmt);
              const columns = result.columns || [];
              const values = (result.rows || []).map(row => columns.map(col => row[col]));
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                columns,
                values,
                rowsAffected: result.rowsAffected,
                lastInsertRowid: result.lastInsertRowid ? String(result.lastInsertRowid) : null
              }));
            } else if (req.url === "/batch") {
              const stmts = JSON.parse(body);
              const results = await localClient.batch(stmts);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(results.map(result => {
                const columns = result.columns || [];
                const values = (result.rows || []).map(row => columns.map(col => row[col]));
                return {
                  columns,
                  values,
                  rowsAffected: result.rowsAffected,
                  lastInsertRowid: result.lastInsertRowid ? String(result.lastInsertRowid) : null
                };
              })));
            } else {
              res.writeHead(404).end();
            }
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err?.message || String(err) }));
          }
        });
        return;
      }
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
        return;
      }
      res.writeHead(404).end();
    });

    bridgeServer.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        // Port 4322 is already in use by another instance
      } else {
        console.error("[local-db-bridge] Server error:", err);
      }
    });

    bridgeServer.listen(4322, "127.0.0.1", () => {
      console.log("[local-db-bridge] Local SQLite bridge active on http://127.0.0.1:4322 (local.db)");
    });
  } catch (err) {
    console.error("[local-db-bridge] Failed to start local SQLite bridge:", err);
  }
}
