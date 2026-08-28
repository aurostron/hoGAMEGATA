import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] || "";
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
      }
    }
  }
}
loadEnv();

const twitchId = process.env.TWITCH_CLIENT_ID;
const twitchSecret = process.env.TWITCH_CLIENT_SECRET;

async function run() {
  const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${twitchId}&client_secret=${twitchSecret}&grant_type=client_credentials`, {
    method: "POST"
  });
  const { access_token } = await tokenResponse.json() as { access_token: string };

  const query = async (body: string) => {
    const res = await fetch("https://api.igdb.com/v4/games/count", {
      method: "POST",
      headers: { "Client-ID": twitchId, "Authorization": `Bearer ${access_token}`, "Content-Type": "text/plain" },
      body
    });
    return res.json();
  };

  console.log("Total theme 19:", await query("where themes = (19);"));
  console.log("Main games category 0:", await query("where themes = (19) & category = 0;"));
  console.log("With release date:", await query("where themes = (19) & first_release_date != null;"));
  console.log("With cover:", await query("where themes = (19) & cover != null;"));
}

run().catch(console.error);