const fs = require("fs");
const path = require("path");
const https = require("https");

const dir = path.join(__dirname, "../public/platforms");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const urls = {
  "windows.svg": "https://upload.wikimedia.org/wikipedia/commons/8/87/Windows_logo_-_2012.svg",
  "playstation.svg": "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/playstation.svg",
  "xbox.svg": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Xbox_Logo.svg",
  "nintendoswitch.svg": "https://upload.wikimedia.org/wikipedia/commons/7/7e/Nintendo_Switch_logo_%28icon%29.svg",
  "linux.svg": "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/linux.svg",
  "apple.svg": "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/apple.svg",
  "android.svg": "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/android.svg"
};

console.log("Starting SVG logo downloads sequentially with rate limit protection...");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const downloadFile = (filename, url) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(dir, filename);
    const file = fs.createWriteStream(filePath);
    
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 hoGAMEGATA/1.0"
      }
    };

    https.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filePath, () => {});
        reject(new Error(`Server returned status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log(`✓ Downloaded and saved: ${filename}`);
        resolve();
      });
    }).on("error", (err) => {
      file.close();
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
};

async function start() {
  const entries = Object.entries(urls);
  for (const [filename, url] of entries) {
    try {
      await downloadFile(filename, url);
      // Wait 1.5 seconds between downloads to respect Wikimedia's rate limits
      await sleep(1500);
    } catch (err) {
      console.error(`❌ Failed to download ${filename}:`, err.message);
    }
  }
  console.log("All logo downloads finished.");
}

start();
