import "./load-env";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
  console.error("❌ TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in .env");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

async function getToken(): Promise<string> {
  console.log("🔑 Authenticating with Twitch...");
  const body = `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
  const resp = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error(`Twitch auth failed: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as { access_token: string };
  console.log("✅ Token obtained\n");
  return data.access_token;
}

async function igdbGet(endpoint: string, token: string): Promise<any> {
  const resp = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "GET",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`IGDB ${endpoint} failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

async function listDumps(token: string): Promise<any[]> {
  console.log("📡 Fetching available data dumps...");
  const dumps = await igdbGet("dumps", token);
  return dumps;
}

async function getDumpInfo(endpoint: string, token: string): Promise<any> {
  return igdbGet(`dumps/${endpoint}`, token);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const fileStream = fs.createWriteStream(destPath);
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No response body");

  const contentLength = resp.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    received += value.length;
    if (total > 0) {
      const pct = ((received / total) * 100).toFixed(1);
      process.stdout.write(`\r  ⬇️  Downloading... ${pct}% (${formatBytes(received)} / ${formatBytes(total)})`);
    }
  }
  fileStream.end();
  await new Promise<void>((resolve) => fileStream.on("finish", resolve));
  console.log(`\n  ✅ Saved to ${destPath}`);
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     IGDB Data Dumps Explorer         ║");
  console.log("╚══════════════════════════════════════╝\n");

  const token = await getToken();
  const dumps = await listDumps(token);

  if (!dumps || dumps.length === 0) {
    console.log("ℹ️  No data dumps available for your account.");
    console.log("   Data Dumps require a commercial partnership with IGDB.");
    console.log("   Contact partner@igdb.com for more info.\n");
    rl.close();
    return;
  }

  const REQUIRED_ENDPOINTS = [
    "games",
    "covers",
    "screenshots",
    "involved_companies",
    "companies",
    "platforms",
    "genres",
    "websites",
    "game_videos",
    "keywords",
    "player_perspectives"
  ];

  console.log("👉 Choose an action:");
  console.log("  1. Download ALL dumps required for Gamegata (~680 MB total)");
  console.log("  2. Download ALL 74 available dumps from IGDB (Several Gigabytes)");
  console.log("  3. Select and download a single dump from the full list");
  console.log("  4. Quit");

  const actionChoice = await ask("\nSelect action [1-4]: ");

  if (actionChoice === "1") {
    console.log(`\n📦 The following ${REQUIRED_ENDPOINTS.length} dumps will be downloaded:`);
    console.log(`   ${REQUIRED_ENDPOINTS.join(", ")}`);
    const confirm = await ask("\n⬇️  Proceed with download? (y/n): ");
    if (confirm.toLowerCase() !== "y") {
      console.log("Cancelled.");
      rl.close();
      return;
    }

    const downloadsDir = path.join(process.cwd(), "scripts", "igdb-dumps");
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    for (const endpoint of REQUIRED_ENDPOINTS) {
      console.log(`\n🔍 Fetching info for "${endpoint}"...`);
      try {
        const info = await getDumpInfo(endpoint, token);
        if (!info.s3_url) {
          console.log(`❌ No download URL available for "${endpoint}". Skipping.`);
          continue;
        }
        console.log(`  📁 File: ${info.file_name} (${formatBytes(info.size_bytes)})`);
        const destPath = path.join(downloadsDir, info.file_name);
        await downloadFile(info.s3_url, destPath);

        const schemaPath = destPath.replace(".csv", "_schema.json");
        fs.writeFileSync(schemaPath, JSON.stringify({ endpoint: info.endpoint, schema_version: info.schema_version, schema: info.schema }, null, 2));
      } catch (err: any) {
        console.error(`❌ Failed to download "${endpoint}":`, err.message);
      }
    }
    console.log("\n✅ All required dumps downloaded successfully!");
    rl.close();
    return;
  }

  if (actionChoice === "2") {
    console.log(`\n⚠️  WARNING: This will download all ${dumps.length} available dumps from IGDB.`);
    console.log("   This is several gigabytes of data and might take a long time.");
    const confirm = await ask("\n⬇️  Proceed with downloading all 74 files? (y/n): ");
    if (confirm.toLowerCase() !== "y") {
      console.log("Cancelled.");
      rl.close();
      return;
    }

    const downloadsDir = path.join(process.cwd(), "scripts", "igdb-dumps");
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    let count = 0;
    for (const d of dumps) {
      count++;
      console.log(`\n🔍 [${count}/${dumps.length}] Fetching info for "${d.endpoint}"...`);
      try {
        const info = await getDumpInfo(d.endpoint, token);
        if (!info.s3_url) {
          console.log(`❌ No download URL available for "${d.endpoint}". Skipping.`);
          continue;
        }
        console.log(`  📁 File: ${info.file_name} (${formatBytes(info.size_bytes)})`);
        const destPath = path.join(downloadsDir, info.file_name);
        await downloadFile(info.s3_url, destPath);

        const schemaPath = destPath.replace(".csv", "_schema.json");
        fs.writeFileSync(schemaPath, JSON.stringify({ endpoint: info.endpoint, schema_version: info.schema_version, schema: info.schema }, null, 2));
      } catch (err: any) {
        console.error(`❌ Failed to download "${d.endpoint}":`, err.message);
      }
    }
    console.log("\n✅ All 74 dumps downloaded successfully!");
    rl.close();
    return;
  }

  if (actionChoice === "3") {
    console.log(`📦 Found ${dumps.length} available dumps:\n`);
    for (let i = 0; i < dumps.length; i++) {
      const d = dumps[i];
      console.log(`  ${i + 1}. ${d.endpoint.padEnd(25)} ${d.file_name}  (${formatDate(d.updated_at)})`);
    }

    const choice = await ask(`\n👉 Select a dump to download (1-${dumps.length}, or 'q' to quit): `);
    const idx = parseInt(choice, 10);

    if (isNaN(idx) || idx < 1 || idx > dumps.length) {
      console.log("Invalid selection.");
      rl.close();
      return;
    }

    const selected = dumps[idx - 1];
    console.log(`\n🔍 Fetching download info for "${selected.endpoint}"...`);

    const info = await getDumpInfo(selected.endpoint, token);

    if (!info.s3_url) {
      console.log("❌ No download URL available. This dump may not be accessible.");
      rl.close();
      return;
    }

    console.log(`  📁 File: ${info.file_name}`);
    console.log(`  📏 Size: ${formatBytes(info.size_bytes)}`);
    console.log(`  🕐 Updated: ${formatDate(info.updated_at)}`);
    console.log(`  📋 Schema v${info.schema_version}`);
    console.log(`  📝 Fields: ${Object.keys(info.schema).join(", ")}\n`);

    const confirm = await ask("⬇️  Download this file? (y/n): ");
    if (confirm.toLowerCase() !== "y") {
      console.log("Cancelled.");
      rl.close();
      return;
    }

    const downloadsDir = path.join(process.cwd(), "scripts", "igdb-dumps");
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    const destPath = path.join(downloadsDir, info.file_name);
    await downloadFile(info.s3_url, destPath);

    // Show schema info as JSON alongside CSV
    const schemaPath = destPath.replace(".csv", "_schema.json");
    fs.writeFileSync(schemaPath, JSON.stringify({ endpoint: info.endpoint, schema_version: info.schema_version, schema: info.schema }, null, 2));
    console.log(`  📋 Schema saved to ${schemaPath}`);
  }

  rl.close();
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  rl.close();
  process.exit(1);
});
