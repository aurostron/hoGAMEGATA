async function main() {
  console.log("Testing FreeLLMAPI JSON response formatting...");
  const sample = [
    {
      id: "test-1",
      title: "Silent Hill 2",
      summary: "A psychological horror masterpiece about James Sunderland investigating his dead wife's letter in a foggy town."
    },
    {
      id: "test-2",
      title: "Calculator 999",
      summary: "A simple calculator utility to add numbers."
    }
  ];

  const prompt = `You are a video game archivist.
Classify each game into:
isHorror: true or false
classification: "pure-horror" | "horror-adjacent" | "non-horror"
reason: 1 sentence

GAMES:
${JSON.stringify(sample, null, 2)}

Respond with ONLY a valid JSON array:
[
  {
    "id": "...",
    "title": "...",
    "isHorror": true,
    "classification": "pure-horror",
    "reason": "..."
  }
]`;

  const res = await fetch("http://127.0.0.1:3001/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer freellmapi-763409939c8e69b02b83ace5547a3090f7b8e96dc990f424",
    },
    body: JSON.stringify({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.choices[0].message.content;
  console.log("Raw output:\n", text);
  const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  console.log("Parsed JSON valid:", !!jsonMatch);
  if (jsonMatch) {
    console.log(JSON.parse(jsonMatch[0]));
  }
}

main().catch(console.error);
