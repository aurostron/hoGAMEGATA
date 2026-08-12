import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({ error: 'Waitlist registration is closed.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
};
