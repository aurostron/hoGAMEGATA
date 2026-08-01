import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as authSchema from "../db/auth-schema";

// Cached singleton — creating new drizzle + libSQL clients per-request is too
// CPU-expensive for Cloudflare Workers (10ms CPU limit on free plan).
// We cache the instance and reuse it across requests in the same isolate.
let cachedDb: ReturnType<typeof drizzle<typeof authSchema>> | null = null;
let cachedConfigKey = "";

export function initTursoAuthForRequest(env: any) {
  const dbUrl = env?.AUTH_DATABASE_URL || (typeof process !== "undefined" ? process.env?.AUTH_DATABASE_URL : null) || (import.meta as any).env?.AUTH_DATABASE_URL;
  const dbToken = env?.AUTH_DATABASE_TOKEN || (typeof process !== "undefined" ? process.env?.AUTH_DATABASE_TOKEN : null) || (import.meta as any).env?.AUTH_DATABASE_TOKEN;

  if (!dbUrl) return;

  // Reuse cached instance if config hasn't changed (same isolate, same secrets)
  const configKey = `${dbUrl}:${(dbToken || "").slice(0, 10)}`;
  if (cachedDb && cachedConfigKey === configKey) {
    (globalThis as any).tursoAuthInstance = cachedDb;
    return;
  }

  const client = createWebClient({
    url: dbUrl,
    authToken: dbToken,
    fetch: (...args: [any, any?]) => fetch(...args),
  });

  cachedDb = drizzle(client, { schema: authSchema });
  cachedConfigKey = configKey;
  (globalThis as any).tursoAuthInstance = cachedDb;
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
