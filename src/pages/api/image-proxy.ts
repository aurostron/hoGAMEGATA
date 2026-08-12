import { rateLimit, getClientIp, tooManyRequests } from '../../lib/rateLimit';
import type { APIRoute } from 'astro';

export const prerender = false;

// Security: Whitelisted hosts permitted to fetch images via our proxy to prevent SSRF
const ALLOWED_HOSTS = [
  'iili.io',
  'freeimage.host',
  'catbox.moe',
  'files.catbox.moe',
  'litterbox.catbox.moe',
  'res.cloudinary.com',
  'cloudinary.com',
  'tmpfiles.org',
  'images.igdb.com',
  'img.youtube.com',
  'youtube.com',
  'i.ytimg.com',
  'media.rawg.io',
  'rawg.io',
  'img.itch.zone',
  'itch.zone',
  'images-common.gog-statics.com',
  'gog-statics.com',
  'steamstatic.com',
  'steampowered.com',
  'media.steampowered.com',
  'shared.cloudflare.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'imgur.com',
  'i.imgur.com',
  'postimg.cc',
  'i.postimg.cc',
  'postimages.org',
];

export const GET: APIRoute = async ({ request }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`img_proxy:${clientIp}`, 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  const urlObj = new URL(request.url);
  const targetUrlStr = urlObj.searchParams.get('url');

  if (!targetUrlStr) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const targetUrl = new URL(targetUrlStr);
    
    // Security: Only allow proxying from whitelisted hosts
    const isAllowed = ALLOWED_HOSTS.some(host => 
      targetUrl.hostname === host || targetUrl.hostname.endsWith('.' + host)
    );

    if (!isAllowed) {
      return new Response('Forbidden target host', { status: 403 });
    }

    const response = await fetch(targetUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 hoGAMEGATA-Image-Proxy/1.0',
      },
    });

    if (!response.ok) {
      return new Response('Failed to fetch remote image', { status: response.status });
    }

    const contentType = response.headers.get('Content-Type');
    const imageBuffer = await response.arrayBuffer();

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/webp',
        // Instruct Cloudflare Edge CDN and browser client to cache aggressively for 1 year
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Image proxy failed:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
