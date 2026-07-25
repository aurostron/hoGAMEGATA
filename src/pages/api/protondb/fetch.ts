import type { APIRoute } from 'astro';
import { fetchProtonDbSummary } from '../../../lib/protondb';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const appId = url.searchParams.get('appId');
  if (!appId) {
    return new Response(
      JSON.stringify({ error: 'Missing appId or ProtonDB URL parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const summary = await fetchProtonDbSummary(appId);
  if (!summary) {
    return new Response(
      JSON.stringify({ error: 'No ProtonDB data found for this App ID / URL' }),
      { status: 444, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify(summary),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
