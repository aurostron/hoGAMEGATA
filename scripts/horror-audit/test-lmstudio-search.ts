import "../load-env";
import { rawDb } from "./client";

interface EnrichedHorrorGame {
  id: string;
  title: string;
  isHorror: boolean;
  classification: "pure-horror" | "horror-adjacent" | "non-horror";
  subFeelings: string[];
  scareRating: number;
  atmosphereRating: number;
  reason: string;
}

async function searchWeb(query: string): Promise<string> {
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "basic",
          max_results: 2,
        }),
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.map((r: any) => `${r.title}: ${r.content}`).join("\n\n");
      }
    } catch (e: any) {
      console.warn("Tavily error:", e.message);
    }
  }

  if (process.env.EXA_API_KEY) {
    try {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.EXA_API_KEY,
        },
        body: JSON.stringify({
          query,
          numResults: 2,
        }),
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.map((r: any) => `${r.title}: ${r.url}`).join("\n");
      }
    } catch (e: any) {
      console.warn("Exa error:", e.message);
    }
  }

  return "";
}

async function evaluateWithLMStudio(game: any, searchContext: string): Promise<EnrichedHorrorGame> {
  const prompt = `You are the lead curator for Gamegata, the ultimate horror game catalog.
Game Information:
- Title: ${game.title}
- Developer: ${game.developerNames || "Unknown"}
- Current Summary: ${game.summary || "No summary available"}
- Additional Web Context: ${searchContext || "None"}

Evaluate this game based on Gamegata's expansive affective horror philosophy (including pure horror, psychological dread, gothic suspense, surreal weird, analog horror, retro ps1 survival horror, or horror-adjacent themes):
Respond strictly in valid JSON with these keys:
{
  "isHorror": boolean,
  "classification": "pure-horror" | "horror-adjacent" | "non-horror",
  "subFeelings": string[], // e.g. ["cosmic-dread", "claustrophobia", "body-horror", "paranoia", "analog-horror", "uncanny", "creeping-tension"]
  "scareRating": number, // 0 to 100 based on psychological tension, jump scares, visceral horror, or oppressive atmosphere
  "atmosphereRating": number, // 0 to 100
  "reason": "Concise 1-2 sentence explanation of its horror sub-genre and feeling"
}`;

  const res = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3.5-9b-claude-4.6-highiq-instruct-heretic-uncensored",
      messages: [
        {
          role: "system",
          content: "You are an expert game critic specializing in horror games. Always output pure valid JSON without markdown formatting or code blocks.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  });

  const data = await res.json();
  const rawText = data.choices[0]?.message?.content?.trim() || "{}";
  const cleanJson = rawText.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      id: game.id,
      title: game.title,
      ...parsed,
    };
  } catch (err) {
    return {
      id: game.id,
      title: game.title,
      isHorror: true,
      classification: "horror-adjacent",
      subFeelings: ["atmospheric"],
      scareRating: 50,
      atmosphereRating: 50,
      reason: "Parse fallback: " + rawText.slice(0, 100),
    };
  }
}

async function main() {
  console.log("Testing sample obscure itch game with LM Studio + Tavily/Exa...");
  const res = await rawDb.execute(
    `SELECT id, title, summary, source, developerNames FROM "Game" WHERE "scareRating" IS NULL AND source = 'itch' AND length(summary) < 60 LIMIT 1`
  );

  const game = res.rows[0];
  console.log("\n🎮 Selected Game from TursoDB:", game.title, `(${game.source})`);
  console.log("   Developer:", game.developerNames);
  console.log("   Summary:", (game.summary as string)?.slice(0, 100) || "None");

  console.log("\n🔍 Querying Web Context via Tavily...");
  const webContext = await searchWeb(`${game.title} ${game.developerNames || ""} horror game`);
  console.log("   Web Context Snippet:", webContext.slice(0, 150), "...");

  console.log("\n🧠 Sending to Local LM Studio (Qwen 3.5 9B)...");
  const t0 = Date.now();
  const evaluation = await evaluateWithLMStudio(game, webContext);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  console.log(`\n⚡ Evaluation Complete in ${elapsed}s:`);
  console.log(JSON.stringify(evaluation, null, 2));
}

main().catch(console.error);
