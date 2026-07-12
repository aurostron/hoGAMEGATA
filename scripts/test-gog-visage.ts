import "./load-env";

async function main() {
  const url = "https://catalog.gog.com/v1/catalog?order=desc:popularity&limit=3&search=visage";
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any;
      console.log("Products returned count:", data.products?.length);
      console.log(JSON.stringify(data.products, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}
main();
