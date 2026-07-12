import "./load-env";

async function testCatalog(headers: Record<string, string>) {
  const url = "https://catalog.gog.com/v1/catalog?order=desc:popularity&limit=3&query=like:gloomwood&countryCode=US&locale=en-US&currencyCode=USD";
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json() as any;
      const p = data.products?.find((item: any) => item.slug === "gloomwood");
      console.log(`Headers: ${JSON.stringify(headers)} -> Price is null? ${p?.price === null} (${p?.price ? JSON.stringify(p.price) : "null"})`);
    }
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  await testCatalog({});
  await testCatalog({ "gog-country": "US" });
  await testCatalog({ "Cookie": "gog_country=US" });
  await testCatalog({ "Cookie": "gog-country=US" });
  await testCatalog({ "X-Country-Code": "US" });
  await testCatalog({ "CF-IPCountry": "US" });
}
main();
