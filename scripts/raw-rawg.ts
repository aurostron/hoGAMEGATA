import "./load-env";

async function main() {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    console.log("No RAWG API Key found!");
    return;
  }
  
  const slug = "heaven-dust-2";
  const url = `https://api.rawg.io/api/games/${slug}?key=${apiKey}`;
  
  console.log(`Fetching raw RAWG data from: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`Failed to fetch: ${response.status} ${response.statusText}`);
    return;
  }
  
  const data = await response.json();
  const pcPlatform = data.platforms?.find((p: any) => p.platform?.slug === "pc");
  console.log("pcPlatform object:");
  console.log(JSON.stringify(pcPlatform || {}, null, 2));
}
main().catch(console.error);
