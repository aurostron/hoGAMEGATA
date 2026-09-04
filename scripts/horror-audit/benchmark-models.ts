const ROUTER_URL = "http://127.0.0.1:3001/v1/chat/completions";
const ROUTER_TOKEN = "freellmapi-763409939c8e69b02b83ace5547a3090f7b8e96dc990f424";

async function testModel(modelName: string) {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s max

    const res = await fetch(ROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ROUTER_TOKEN}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "Reply with JSON: [{\"id\": 1, \"ok\": true}]" }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const time = ((Date.now() - t0) / 1000).toFixed(2);
    if (!res.ok) {
      console.log(`❌ ${modelName}: HTTP ${res.status} (${time}s)`);
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log(`⚡ ${modelName}: SUCCESS in ${time}s (routed via ${data._routed_via?.platform || 'direct'}, output: ${content.trim().slice(0, 30)})`);
    return parseFloat(time);
  } catch (e: any) {
    console.log(`❌ ${modelName}: ${e.message} (${((Date.now() - t0) / 1000).toFixed(2)}s)`);
    return null;
  }
}

async function main() {
  console.log("Testing model speeds on FreeLLMAPI...");
  const models = [
    "auto",
    "groq/compound-mini",
    "groq/compound",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "deepseek-v4-flash-free",
    "qwen/qwen3.6-27b",
    "stepfun/step-3.7-flash:free",
    "north-mini-code-free"
  ];

  for (const m of models) {
    await testModel(m);
  }
}

main();
