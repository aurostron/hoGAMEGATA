import { rateLimit, getClientIp, tooManyRequests } from '../../../lib/rateLimit';
import type { APIRoute } from 'astro';
import { fetchProtonDbSummary } from '../../../lib/protondb';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`protondb:${clientIp}`, 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter, undefined, request);

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
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
  );
};
