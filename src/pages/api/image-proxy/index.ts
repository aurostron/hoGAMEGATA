import type { APIRoute } from 'astro';
import { handleImageProxy } from '../../../lib/imageProxyHandler';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  return handleImageProxy(request);
};
