import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  schema: "./src/db/auth-schema.ts",
  out: "./migrations-auth",
  dialect: "turso",
  dbCredentials: {
    url: process.env.AUTH_DATABASE_URL || "libsql://dummy",
    authToken: process.env.AUTH_DATABASE_TOKEN,
  },
});
