import "./load-env";

async function main() {
  const prodeusId = "1549165795";
  const url = `https://api.gog.com/products/${prodeusId}/prices?countryCode=IN`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any;
      console.log("Prodeus pricing in India:", JSON.stringify(data._embedded?.prices, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}
main();
