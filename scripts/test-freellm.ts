import OpenAI from "openai";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

// Export OpenAI credentials for FreeLLM
process.env.OPENAI_API_KEY = process.env.FREELLM_API_KEY;

// Proxy configuration (if needed)
if (process.env.PROXY_URL) {
  process.env.HTTPS_PROXY = process.env.PROXY_URL;
  process.env.HTTP_PROXY = process.env.PROXY_URL;
}

// Create OpenAI client using the exported env vars
const client = new OpenAI({
  baseURL: "http://localhost:3001/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  try {
    const response = await client.chat.completions.create({
      model: "auto",
      messages: [{ role: "user", content: "Hello" }],
    });
    console.log("FreeLLM response:", JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("FreeLLM request failed:", err);
  }
}

main();
