import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";

// No top-level process.env reads or top-level await.
// The database is initialized lazily per-request via initTursoForRequest(),
// which is called by the middleware before any route handler runs.

export function initTursoForRequest(env: any) {
  const dbUrl = env?.TURSO_DATABASE_URL;
  const dbToken = env?.TURSO_AUTH_TOKEN;

  if (!dbUrl) return;

  const client = createWebClient({
    url: dbUrl,
    authToken: dbToken,
  });

  const db = drizzle(client, { schema });
  (globalThis as any).tursoInstance = db;
}

// Proxy that forwards all calls to the active request-scoped instance.
// If no instance has been set (middleware hasn't run), DB calls will throw
// a clear error message instead of silently returning undefined.
export const turso = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop, receiver) {
    const activeInstance = (globalThis as any).tursoInstance;
    if (!activeInstance) {
      const propStr = String(prop);
      if (["select", "insert", "update", "delete", "query", "selectDistinct"].includes(propStr)) {
        throw new Error("Turso database client is not initialized. Ensure TURSO_DATABASE_URL is set.");
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
  execute: async (...args: any[]) => {
    const activeInstance = (globalThis as any).tursoInstance;
    if (!activeInstance) {
      throw new Error("Turso database client is not initialized.");
    }
    const rawClient = (activeInstance as any).$client;
    if (rawClient && typeof rawClient.execute === "function") {
      return rawClient.execute(...args);
    }
    throw new Error("Raw libSQL client execute is not available");
  }
};
