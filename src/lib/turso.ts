import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { env as cfEnv } from "cloudflare:workers";
import * as schema from "../db/schema";

// Cached singleton — creating new drizzle + libSQL/D1 clients per-request is too
// CPU-expensive for Cloudflare Workers (10ms CPU limit on free plan).
// We cache the instance and reuse it across requests in the same isolate.
let cachedDb: any = null;
let cachedConfigKey = "";
let activeD1Client: any = null;

export function initTursoForRequest(env: any) {
  // 1. Cloudflare D1 Database binding (Primary production storage)
  const d1 = env?.DB || (cfEnv as any)?.DB;
  if (d1) {
    activeD1Client = d1;
    if (cachedDb && cachedConfigKey === "cloudflare-d1") {
      (globalThis as any).tursoInstance = cachedDb;
      return;
    }
    cachedDb = drizzleD1(d1, { schema });
    cachedConfigKey = "cloudflare-d1";
    (globalThis as any).tursoInstance = cachedDb;
    return;
  }

  // 2. Turso libSQL client (Remote URL + token)
  const dbUrl = env?.TURSO_DATABASE_URL || (cfEnv as any)?.TURSO_DATABASE_URL || (typeof process !== "undefined" ? process.env?.TURSO_DATABASE_URL : null) || (import.meta as any).env?.TURSO_DATABASE_URL;
  const dbToken = env?.TURSO_AUTH_TOKEN || (cfEnv as any)?.TURSO_AUTH_TOKEN || (typeof process !== "undefined" ? process.env?.TURSO_AUTH_TOKEN : null) || (import.meta as any).env?.TURSO_AUTH_TOKEN;

  if (dbUrl) {
    const configKey = `${dbUrl}:${(dbToken || "").slice(0, 10)}`;
    if (cachedDb && cachedConfigKey === configKey) {
      activeD1Client = null;
      (globalThis as any).tursoInstance = cachedDb;
      return;
    }

    const client = createWebClient({
      url: dbUrl,
      authToken: dbToken,
      fetch: (...args: [any, any?]) => fetch(...args),
    });

    cachedDb = drizzleLibsql(client, { schema });
    cachedConfigKey = configKey;
    activeD1Client = null;
    (globalThis as any).tursoInstance = cachedDb;
    return;
  }

  // Local SQLite fallback (Open Source / Dev mode without credentials)
  if (cachedDb && cachedConfigKey === "local-bridge") {
    (globalThis as any).tursoInstance = cachedDb;
    return;
  }

  function formatBridgeResult(data: any) {
    const columns = data.columns || [];
    const rawRows = data.values || data.rows || [];
    const rows = rawRows.map((valArr: any) => {
      const row: any = {};
      if (Array.isArray(valArr)) {
        Object.defineProperty(row, "length", { value: valArr.length });
        for (let i = 0; i < valArr.length; i++) {
          const val = valArr[i];
          Object.defineProperty(row, i, { value: val, enumerable: true, writable: true, configurable: true });
          const col = columns[i];
          if (col && !(col in row)) {
            Object.defineProperty(row, col, { value: val, enumerable: true, writable: true, configurable: true });
          }
        }
      } else if (valArr && typeof valArr === "object") {
        Object.defineProperty(row, "length", { value: columns.length });
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          const val = valArr[col];
          Object.defineProperty(row, i, { value: val, enumerable: true, writable: true, configurable: true });
          if (col && !(col in row)) {
            Object.defineProperty(row, col, { value: val, enumerable: true, writable: true, configurable: true });
          }
        }
      }
      return row;
    });
    return {
      columns,
      rows,
      rowsAffected: data.rowsAffected || 0,
      lastInsertRowid: data.lastInsertRowid ? BigInt(data.lastInsertRowid) : undefined,
    };
  }

  const localBridgeClient = {
    execute: async (stmt: any) => {
      const payload = typeof stmt === "string" ? { sql: stmt, args: [] } : stmt;
      const res = await fetch("http://127.0.0.1:4322/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Local SQLite query failed: ${errText}`);
      }
      const data = await res.json();
      return formatBridgeResult(data);
    },
    batch: async (stmts: any[]) => {
      const res = await fetch("http://127.0.0.1:4322/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmts),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Local SQLite batch failed: ${errText}`);
      }
      const batchData = await res.json();
      return batchData.map((d: any) => formatBridgeResult(d));
    },
    $client: {
      execute: async (...args: any[]) => {
        const stmt = typeof args[0] === "string" ? { sql: args[0], args: args[1] || [] } : args[0];
        const res = await fetch("http://127.0.0.1:4322/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stmt),
        });
        const data = await res.json();
        return formatBridgeResult(data);
      }
    }
  };

  cachedDb = drizzleLibsql(localBridgeClient as any, { schema });
  cachedConfigKey = "local-bridge";
  activeD1Client = null;
  (globalThis as any).tursoInstance = cachedDb;
}

// Proxy that forwards all calls to the active request-scoped instance.
export const turso = new Proxy({} as ReturnType<typeof drizzleLibsql<typeof schema>>, {
  get(target, prop, receiver) {
    let activeInstance = (globalThis as any).tursoInstance;
    if (!activeInstance) {
      initTursoForRequest({});
      activeInstance = (globalThis as any).tursoInstance;
    }
    if (!activeInstance) {
      const propStr = String(prop);
      if (["select", "insert", "update", "delete", "query", "selectDistinct"].includes(propStr)) {
        throw new Error("Database client is not initialized. Ensure D1 binding DB or TURSO_DATABASE_URL is set.");
      }
      return undefined;
    }
    const value = Reflect.get(activeInstance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(activeInstance);
    }
    return value;
  },
});

// Helper getter to access raw client if needed
export const libsqlClient = {
  execute: async (stmt: any, ...params: any[]) => {
    if (!activeD1Client && !(globalThis as any).tursoInstance) {
      initTursoForRequest({});
    }
    if (activeD1Client) {
      const sqlText = typeof stmt === "string" ? stmt : stmt.sql;
      const sqlArgs = typeof stmt === "string" ? (params || []) : (stmt.args || []);
      const statement = activeD1Client.prepare(sqlText);
      const bound = sqlArgs && sqlArgs.length > 0 ? statement.bind(...sqlArgs) : statement;
      const res = await bound.all();
      return {
        columns: res.results && res.results.length > 0 ? Object.keys(res.results[0] as object) : [],
        rows: res.results || [],
        rowsAffected: res.meta?.changes || 0,
      };
    }
    const activeInstance = (globalThis as any).tursoInstance;
    if (!activeInstance) {
      throw new Error("Database client is not initialized.");
    }
    const rawClient = (activeInstance as any).$client;
    if (rawClient && typeof rawClient.execute === "function") {
      return rawClient.execute(stmt, ...params);
    }
    throw new Error("Raw database client execute is not available");
  }
};
