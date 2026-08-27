import type { APIRoute } from 'astro';
import { handleImageProxy } from '../../../lib/imageProxyHandler';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  const customFilename = params.name ? decodeURIComponent(params.name) : undefined;
  return handleImageProxy(request, customFilename);
};
