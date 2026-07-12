import "./load-env";

async function main() {
  const url = "https://catalog.gog.com/v1/catalog?limit=20&query=like:Sundered";
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any;
      console.log(JSON.stringify(data.products?.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title
      })), null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}
main();
