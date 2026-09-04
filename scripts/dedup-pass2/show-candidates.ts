import * as fs from "fs";
import * as path from "path";

function main() {
  const dataDir = path.resolve(process.cwd(), "scripts/dedup-pass2/data");
  const poolA = JSON.parse(fs.readFileSync(path.join(dataDir, "audit_pool_a.json"), "utf-8"));

  console.log(`\n==================================================`);
  console.log(`📋 PASS 2: ALL ${poolA.length} POOL A CANDIDATES`);
  console.log(`==================================================`);

  poolA.forEach((c: any, i: number) => {
    const sec = c.secondaries[0];
    console.log(`[${i + 1}] PRIMARY:   "${c.primary.title}" (${c.primary.slug}) [${c.primary.developerNames}]`);
    console.log(`    SECONDARY: "${sec.title}" (${sec.slug}) [${sec.developerNames}]`);
    console.log(`    REASON:    ${c.reason}\n`);
  });
}

main();
