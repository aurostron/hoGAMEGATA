import "./load-env";
import { turso, initTursoForRequest } from "../src/lib/turso";
initTursoForRequest(process.env);
import { siteContent } from "../src/db/schema";
import { DEFAULT_CONTENT } from "../src/lib/siteContent";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🛠️ Syncing VS Code siteContent defaults to Turso DB...");

  for (const item of DEFAULT_CONTENT) {
    console.log(`Updating key: ${item.key} -> "${item.value}"`);
    await turso
      .insert(siteContent)
      .values({
        key: item.key,
        value: item.value,
        type: item.type,
        label: item.label,
        section: item.section,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteContent.key,
        set: {
          value: item.value,
          label: item.label,
          section: item.section,
          updatedAt: new Date(),
        },
      });
  }

  console.log("✅ SiteContent table successfully updated in Turso DB!");
}

main().catch((err) => {
  console.error("❌ Failed to update site content:", err);
  process.exit(1);
});
