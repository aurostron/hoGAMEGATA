import "./load-env";
import { rawDb } from "./dedup-pass2/client";

async function main() {
  console.log("=== SCANNING FOR POTENTIALLY NON-HORROR GAMES ===");

  const suspiciousTitles = [
    'soccer', 'football', 'basketball', 'baseball', 'cricket', 'golf', 'tennis',
    'farming simulator', 'cooking', 'dress up', 'wedding', 'math', 'calculator',
    'barbie', 'peppa pig', 'paw patrol', 'solitaire', 'mahjong', 'chess'
  ];

  for (const term of suspiciousTitles) {
    const res = await rawDb.execute({
      sql: `
        SELECT id, title, slug, summary, "developerNames", source
        FROM "Game"
        WHERE (status IS NULL OR status != 'hidden')
          AND lower(title) LIKE ?
        LIMIT 5
      `,
      args: [`%${term}%`]
    });

    if (res.rows.length > 0) {
      console.log(`\n🔍 Search term: "${term}" (${res.rows.length} found):`);
      for (const r of res.rows) {
        const desc = r.summary ? (r.summary as string).slice(0, 75).replace(/\n/g, ' ') : 'No summary';
        console.log(`  - "${r.title}" (${r.slug}) [${r.source || 'igdb'}] -> ${desc}...`);
      }
    }
  }
}

main().catch(console.error);
