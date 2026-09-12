import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { env as cfEnv } from "cloudflare:workers";
import * as authSchema from "../db/auth-schema";

// Cached singleton — creating new drizzle + libSQL clients per-request is too
// CPU-expensive for Cloudflare Workers (10ms CPU limit on free plan).
// We cache the instance and reuse it across requests in the same isolate.
let cachedDb: any = null;
let cachedConfigKey = "";

export function initTursoAuthForRequest(env: any) {
  // 1. Cloudflare D1 Database binding (Primary storage when running on Cloudflare Workers)
  const d1 = env?.AUTH_DB || env?.DB || (cfEnv as any)?.AUTH_DB || (cfEnv as any)?.DB;
  if (d1) {
    if (cachedDb && cachedConfigKey === "cloudflare-d1-auth") {
      (globalThis as any).tursoAuthInstance = cachedDb;
      return;
    }
    cachedDb = drizzleD1(d1, { schema: authSchema });
    cachedConfigKey = "cloudflare-d1-auth";
    (globalThis as any).tursoAuthInstance = cachedDb;
    return;
  }

  const dbUrl = env?.AUTH_DATABASE_URL || (cfEnv as any)?.AUTH_DATABASE_URL || (typeof process !== "undefined" ? process.env?.AUTH_DATABASE_URL : null) || (import.meta as any).env?.AUTH_DATABASE_URL;
  const dbToken = env?.AUTH_DATABASE_TOKEN || (cfEnv as any)?.AUTH_DATABASE_TOKEN || (typeof process !== "undefined" ? process.env?.AUTH_DATABASE_TOKEN : null) || (import.meta as any).env?.AUTH_DATABASE_TOKEN;

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

  cachedDb = drizzleLibsql(client, { schema: authSchema });
  cachedConfigKey = configKey;
  (globalThis as any).tursoAuthInstance = cachedDb;
}

// Proxy that forwards all calls to the active request-scoped instance.
export const tursoAuth = new Proxy({} as ReturnType<typeof drizzleLibsql<typeof authSchema>>, {
  get(target, prop, receiver) {
    let activeInstance = (globalThis as any).tursoAuthInstance;
    if (!activeInstance) {
      // Attempt self-healing initialization from environment
      initTursoAuthForRequest({});
      activeInstance = (globalThis as any).tursoAuthInstance;
    }
    if (!activeInstance) {
      const propStr = String(prop);
      if (["select", "insert", "update", "delete", "query", "selectDistinct"].includes(propStr)) {
        throw new Error("Auth database client is not initialized. Ensure AUTH_DATABASE_URL or D1 binding is set in environment.");
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
