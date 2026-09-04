import "../load-env";
import { createClient } from "@libsql/client";

export const rawDb = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
