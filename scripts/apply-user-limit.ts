import { db } from "../src/lib/db";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Applying user limit trigger to PostgreSQL database...");

  // 1. Create or replace the check_user_limit function
  // We allow user insertion if the total count < 10000.
  // We also check if the user already exists in the table to permit updates/logins.
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION check_user_limit()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (SELECT COUNT(*) FROM "User") >= 10000 THEN
        IF EXISTS (SELECT 1 FROM "User" WHERE id = NEW.id) THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Registration cap of 10,000 users has been reached.';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Drop existing trigger if it exists
  await db.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS limit_users_trigger ON "User";
  `);

  // 3. Attach trigger BEFORE INSERT on the User table
  await db.$executeRawUnsafe(`
    CREATE TRIGGER limit_users_trigger
    BEFORE INSERT ON "User"
    FOR EACH ROW EXECUTE FUNCTION check_user_limit();
  `);

  console.log("✅ User limit trigger successfully applied!");
}

main()
  .catch((e) => {
    console.error("❌ Failed to apply user limit trigger:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
