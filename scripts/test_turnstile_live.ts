async function verifyGatewayLive() {
  console.log("=== Testing Live Gateway & Verify Routes on gamegata.xyz ===");

  // 1. GET Gateway page for Visage / GOG
  const pageRes = await fetch("https://gamegata.xyz/re/visage/gog?fallbackUrl=https%3A%2F%2Fwww.gog.com%2Fgame%2Fvisage");
  console.log("1. GET /re/visage/gog Status:", pageRes.status);
  const pageHtml = await pageRes.text();
  console.log("Contains Turnstile widget:", pageHtml.includes("cf-turnstile"));
  console.log("Contains sitekey:", pageHtml.includes("0x4AAAAAADxZWPj99fIewEFh"));
  console.log("Contains isVerifying guard:", pageHtml.includes("isVerifying"));

  // 2. Test verify endpoint with double-slash safety
  const verifyRes = await fetch("https://gamegata.xyz/re/visage/gog/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  console.log("2. POST /re/visage/gog/verify (Missing token):", verifyRes.status, await verifyRes.json());
}

verifyGatewayLive().catch(console.error);
