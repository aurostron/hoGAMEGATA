import "./load-env";

async function testUrl(url: string) {
  console.log(`\nTesting: ${url}`);
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any;
      console.log("Returned products count:", data.products?.length);
      if (data.products && data.products.length > 0) {
        console.log(JSON.stringify(data.products.map((item: any) => ({
          slug: item.slug,
          title: item.title,
          price: item.price
        })), null, 2));
      }
    } else {
      console.log(`Status: ${res.status}`);
    }
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  await testUrl("https://catalog.gog.com/v1/catalog?slug=gloomwood");
  await testUrl("https://catalog.gog.com/v1/catalog?slugs=gloomwood");
  await testUrl("https://catalog.gog.com/v1/catalog?slugs[]=gloomwood");
  await testUrl("https://catalog.gog.com/v1/catalog?query=slug:gloomwood");
  await testUrl("https://catalog.gog.com/v1/catalog?query=gloomwood");
}
main();
