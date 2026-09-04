import * as fs from "fs";
import * as path from "path";

function main() {
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pass2/data");
  const poolC = JSON.parse(fs.readFileSync(path.join(dataDir, "audit_pool_c.json"), "utf-8"));

  console.log(`\n==================================================`);
  console.log(`📋 PASS 2: POOL C SAMPLES (${poolC.length} TOTAL)`);
  console.log(`==================================================`);

  poolC.slice(0, 15).forEach((c: any, i: number) => {
    console.log(`[${i + 1}] TITLE: "${c.title}" (${c.reason})`);
    c.games.forEach((g: any) => {
      console.log(`    -> "${g.title}" (${g.slug}) [Dev: ${g.developerNames || 'Unknown'}] [Year: ${g.year || 'N/A'}]`);
    });
    console.log("");
  });
}

main();
