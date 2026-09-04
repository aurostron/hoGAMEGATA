async function main() {
  console.log("Testing FreeLLMAPI local router...");
  const res = await fetch("http://127.0.0.1:3001/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer freellmapi-763409939c8e69b02b83ace5547a3090f7b8e96dc990f424",
    },
    body: JSON.stringify({
      model: "auto",
      messages: [{ role: "user", content: "Reply with ONLY the word HELLO" }],
    }),
  });

  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
