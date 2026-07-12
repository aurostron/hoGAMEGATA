import "./load-env";

async function main() {
  const prodeusAppId = "964800";
  const url = `https://store.steampowered.com/api/appdetails?appids=${prodeusAppId}&cc=in&filters=price_overview`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any;
      console.log("Steam Prodeus India price details:", JSON.stringify(data[prodeusAppId]?.data?.price_overview, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}
main();
