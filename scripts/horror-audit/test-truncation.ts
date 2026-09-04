import "../load-env";
import { rawDb } from "./client";

async function test() {
  const res = await rawDb.execute(
    `SELECT id, title, summary, source, developerNames FROM "Game" WHERE title LIKE '%Isaac%Repentance%' LIMIT 1`
  );
  const game = res.rows[0];

  const tRes = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: `${game.title} horror game review reddit`,
      max_results: 2,
    }),
  });
  const tData = await tRes.json();
  const context = tData.results?.map((r: any) => `${r.title}: ${r.content}`).join("\n\n") || "";

  console.log("Context characters:", context.length);

  const cRes = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3.5-9b-claude-4.6-highiq-instruct-heretic-uncensored",
      messages: [
        { role: "system", content: "You are an expert horror game analyst. Output pure valid JSON without markdown code fences." },
        { role: "user", content: `Evaluate ${game.title} with context:\n${context}\nOutput valid JSON.` },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    }),
  });
  const cData = await cRes.json();
  console.log("Finish reason:", cData.choices?.[0]?.finish_reason);
  console.log("Usage:", cData.usage);
  console.log("Output length:", cData.choices?.[0]?.message?.content?.length);
  console.log("Full output:\n", cData.choices?.[0]?.message?.content);
}

test().catch(console.error);
