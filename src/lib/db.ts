import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let cachedPrisma: PrismaClient | undefined = globalForPrisma.prisma;

function getPrismaClient(): PrismaClient {
  if (typeof window !== "undefined") {
    return {} as PrismaClient;
  }

  if (cachedPrisma) {
    return cachedPrisma;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL is not set. Database queries will fail.");
    // Return a dummy PrismaClient proxy that throws on database access
    return new Proxy({} as PrismaClient, {
      get(target, prop) {
        throw new Error(
          `Prisma query was executed but DATABASE_URL is not configured in .env. Requested property: db.${String(prop)}`
        );
      },
    });
  }

  try {
    if (connectionString.startsWith("prisma+postgres://")) {
      cachedPrisma = new PrismaClient({ accelerateUrl: connectionString });
    } else {
      const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
      const pool = new Pool({
        connectionString,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
      });
      const adapter = new PrismaPg(pool);
      cachedPrisma = new PrismaClient({ adapter });
    }

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = cachedPrisma;
    }

    return cachedPrisma;
  } catch (error) {
    console.error("❌ Failed to initialize PrismaClient:", error);
    throw error;
  }
}

// Export a proxy that forwards all database calls to the lazily initialized client
export const db = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
