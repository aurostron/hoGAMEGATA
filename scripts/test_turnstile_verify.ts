async function testVerify() {
  console.log("Testing POST to https://gamegata.xyz/re/visage/gog/verify ...");
  
  // Test 1: No token
  const res1 = await fetch("https://gamegata.xyz/re/visage/gog/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  console.log("Test 1 (No token) Status:", res1.status, await res1.text());

  // Test 2: Invalid/dummy token
  const res2 = await fetch("https://gamegata.xyz/re/visage/gog/verify?fallbackUrl=https%3A%2F%2Fwww.gog.com%2Fgame%2Fvisage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "dummy-test-token" })
  });
  console.log("Test 2 (Dummy token) Status:", res2.status, await res2.text());

  // Test 3: Trailing slash verify
  const res3 = await fetch("https://gamegata.xyz/re/visage/gog//verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "dummy-test-token" })
  });
  console.log("Test 3 (Double slash //verify) Status:", res3.status);

  // Test 4: Check siteverify response with Cloudflare secret directly
  const secretKey = "";
  const cfTest = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${encodeURIComponent(secretKey)}&response=dummy`
  });
  console.log("Test 4 (Cloudflare siteverify direct with secret):", await cfTest.json());
}

testVerify().catch(console.error);
