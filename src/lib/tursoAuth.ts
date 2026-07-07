import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as authSchema from "../db/auth-schema";

// No top-level process.env reads or top-level await.
// The auth database is initialized lazily per-request via initTursoAuthForRequest(),
// which is called by the middleware before any route handler runs.

export function initTursoAuthForRequest(env: any) {
  const dbUrl = env?.AUTH_DATABASE_URL;
  const dbToken = env?.AUTH_DATABASE_TOKEN;

  if (!dbUrl) return;

  const client = createWebClient({
    url: dbUrl,
    authToken: dbToken,
  });

  const db = drizzle(client, { schema: authSchema });
  (globalThis as any).tursoAuthInstance = db;
}

// Proxy that forwards all calls to the active request-scoped instance.
export const tursoAuth = new Proxy({} as ReturnType<typeof drizzle<typeof authSchema>>, {
  get(target, prop, receiver) {
    const activeInstance = (globalThis as any).tursoAuthInstance;
    if (!activeInstance) {
      const propStr = String(prop);
      if (["select", "insert", "update", "delete", "query", "selectDistinct"].includes(propStr)) {
        throw new Error("Auth database client is not initialized. Ensure AUTH_DATABASE_URL is set.");
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
