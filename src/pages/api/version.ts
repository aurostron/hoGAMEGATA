import type { APIRoute } from "astro";
import { getDataVersion } from "../../lib/dataVersion";

export const prerender = false;

export const GET: APIRoute = async () => {
  const version = await getDataVersion();
  return new Response(JSON.stringify(version), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
};
