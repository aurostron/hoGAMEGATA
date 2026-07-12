async function main() {
  try {
    console.log("Fetching http://localhost:4321/game/resident-evil-veronica ...");
    const res = await fetch("http://localhost:4321/game/resident-evil-veronica");
    console.log("Response status:", res.status);
    const text = await res.text();
    console.log("Length of body:", text.length);
    if (res.status === 500) {
      console.log("=== 500 ERROR HTML ===");
      console.log(text.slice(0, 3000));
      console.log("======================");
    } else {
      console.log("Success! Preview:");
      console.log(text.slice(0, 1000));
    }
  } catch (err) {
    console.error("Fetch exception:", err);
  }
}
main();
