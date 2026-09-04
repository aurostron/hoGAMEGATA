import "../load-env";
import { createClient } from "@libsql/client";
import { turso, schema } from "../db-helper";

export const rawDb = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

export { turso, schema };
