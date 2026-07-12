import "./load-env";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import * as fs from "fs";

const rl = readline.createInterface({ input, output });

async function ask(prompt: string): Promise<string> {
  try {
    return await rl.question(prompt);
  } catch {
    return "";
  }
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const IGDB_BASE = "https://api.igdb.com/v4";

async function getAccessToken(): Promise<string> {
  const resp = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!resp.ok) throw new Error(`Token request failed: ${resp.status} ${await resp.text()}`);
  const data: any = await resp.json();
  return data.access_token;
}

function headers(token: string) {
  return {
    "Client-ID": TWITCH_CLIENT_ID!,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

async function listDumps(token: string) {
  console.log("\n📋 Fetching available dumps...");
  const resp = await fetch(`${IGDB_BASE}/dumps`, { headers: headers(token) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GET /dumps failed (${resp.status}): ${text}`);
  }
  const dumps: any[] = await resp.json();
  if (dumps.length === 0) {
    console.log("  (empty — no dumps available for your account)");
    return [];
  }
  console.log(`  Found ${dumps.length} dumps:\n`);
  for (const d of dumps) {
    const date = new Date(d.updated_at * 1000).toISOString().slice(0, 10);
    console.log(`  📄 ${d.endpoint.padEnd(20)} file: ${d.file_name}  (updated ${date})`);
  }
  return dumps;
}

async function getDumpInfo(token: string, endpoint: string) {
  console.log(`\n📦 Fetching dump info for "${endpoint}"...`);
  const resp = await fetch(`${IGDB_BASE}/dumps/${endpoint}`, { headers: headers(token) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GET /dumps/${endpoint} failed (${resp.status}): ${text}`);
  }
  const info: any = await resp.json();
  const sizeMb = (info.size_bytes / 1024 / 1024).toFixed(1);
  const date = new Date(info.updated_at * 1000).toISOString();
  console.log(`  ✅ Endpoint:       ${info.endpoint}`);
  console.log(`  📁 File:           ${info.file_name}`);
  console.log(`  📏 Size:           ${sizeMb} MB`);
  console.log(`  🕐 Updated:        ${date}`);
  console.log(`  🔗 S3 URL:         ${info.s3_url?.slice(0, 80)}...`);
  console.log(`  🧬 Schema version: ${info.schema_version}`);
  if (info.schema) {
    console.log(`  📐 Schema fields:  ${Object.keys(info.schema).join(", ")}`);
  }
  return info;
}

async function downloadDump(s3Url: string, filePath: string) {
  console.log(`\n⬇️  Downloading to "${filePath}"...`);
  const resp = await fetch(s3Url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
  console.log(`  ✅ Saved ${sizeMb} MB to "${filePath}"`);
}

async function menu(token: string) {
  while (true) {
    console.log(`\n${"=".repeat(50)}`);
    console.log("  IGDB DATA DUMP TESTER");
    console.log(`${"=".repeat(50)}`);
    console.log("  1. List available dumps");
    console.log("  2. Show dump info + download URL");
    console.log("  3. Download dump to CSV file");
    console.log("  4. Exit");
    console.log(`${"=".repeat(50)}`);

    const choice = await ask("  Select [1-4]: ");
    if (!choice) break;
    console.log();

    if (choice === "1") {
      try {
        await listDumps(token);
      } catch (e: any) {
        console.error(`  ❌ ${e.message}`);
      }
    } else if (choice === "2") {
      const ep = await ask("  Endpoint name (e.g. games): ");
      if (!ep) continue;
      try {
        await getDumpInfo(token, ep.trim());
      } catch (e: any) {
        console.error(`  ❌ ${e.message}`);
      }
    } else if (choice === "3") {
      const ep = await ask("  Endpoint name (e.g. games): ");
      if (!ep) continue;
      try {
        const info = await getDumpInfo(token, ep.trim());
        const defaultName = info.file_name || `${ep.trim()}_dump.csv`;
        const filePath = await ask(`  Save as [${defaultName}]: `);
        const finalPath = filePath.trim() || defaultName;
        await downloadDump(info.s3_url, finalPath);
      } catch (e: any) {
        console.error(`  ❌ ${e.message}`);
      }
    } else if (choice === "4") {
      console.log("  Bye!");
      break;
    } else {
      console.log("  Invalid choice.");
    }
  }
}

async function main() {
  console.log(`\n${"=".repeat(50)}`);
  console.log("  IGDB Data Dump Tool");
  console.log(`${"=".repeat(50)}`);

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.error("  ❌ TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET not set in .env");
    rl.close();
    return;
  }

  console.log("  🔑 Getting Twitch OAuth token...");
  try {
    const token = await getAccessToken();
    console.log("  ✅ Token acquired!\n");
    await menu(token);
  } catch (e: any) {
    console.error(`  ❌ ${e.message}`);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
