import * as path from "path";
import * as fs from "fs";

/* Try dotenv first, fall back to manual line-by-line parser */
function loadSync(filePath: string): void {
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  loadSync(envPath);
}
// If FREELLM_API_KEY is still missing, try parent directory
if (!process.env.FREELLM_API_KEY) {
  const parentEnv = path.join(process.cwd(), "..", ".env");
  if (fs.existsSync(parentEnv)) loadSync(parentEnv);
}
