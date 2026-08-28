import { rateLimit, getClientIp, tooManyRequests } from './rateLimit';

// Security: Whitelisted hosts permitted to fetch images via our proxy to prevent SSRF
export const ALLOWED_HOSTS = [
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
  'img.itch.io',
  'itch.io',
  'static.itch.io',
  'images-common.gog-statics.com',
  'gog-statics.com',
  'steamstatic.com',
  'steampowered.com',
  'media.steampowered.com',
  'shared.cloudflare.steamstatic.com',
  'shared.akamai.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'imgur.com',
  'i.imgur.com',
  'postimg.cc',
  'i.postimg.cc',
  'postimages.org',
  'media.giphy.com',
  'giphy.com',
  'images.unsplash.com',
];

export async function handleImageProxy(request: Request, customFilename?: string): Promise<Response> {
  // 1. Direct Cloudflare Edge Cache check (bypasses rate limit and network on HIT)
  let cache: any = null;
  let cacheKey: Request | null = null;
  try {
    cache = (globalThis as any).caches?.default;
    if (cache) {
      cacheKey = new Request(request.url, { method: "GET" });
      const cached = await cache.match(cacheKey);
      if (cached) {
        const hitHeaders = new Headers(cached.headers);
        hitHeaders.set("X-Gamegata-Cache", "HIT");
        return new Response(cached.body, {
          status: 200,
          headers: hitHeaders,
        });
      }
    }
  } catch (e) {
    console.error("[ImageProxy Cache Match Error]", e);
  }

  const clientIp = getClientIp(request);
  const rl = await rateLimit(`img_proxy:${clientIp}`, 600, 60);
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

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    if (targetUrl.hostname.includes('itch.zone') || targetUrl.hostname.includes('itch.io')) {
      fetchHeaders['Referer'] = 'https://itch.io/';
    }

    const fetchOptions: any = {
      headers: fetchHeaders,
      cf: {
        cacheEverything: true,
        cacheTtl: 31536000,
      },
    };

    const response = await fetch(targetUrl.href, fetchOptions);

    if (!response.ok) {
      return new Response('Failed to fetch remote image', { status: response.status });
    }

    const contentType = response.headers.get('Content-Type') || 'image/webp';
    const upstreamCfCache = response.headers.get('cf-cache-status') || 'ORIGIN';

    // Derive or sanitize filename for Content-Disposition (e.g. sigmaape-cover.webp)
    let safeFilename = 'image.webp';
    if (customFilename) {
      safeFilename = customFilename.replace(/[^a-zA-Z0-9._-]/g, '');
    } else {
      const pathSegment = targetUrl.pathname.split('/').pop();
      if (pathSegment && pathSegment.length > 2 && pathSegment.includes('.')) {
        safeFilename = pathSegment.replace(/[^a-zA-Z0-9._-]/g, '');
      }
    }

    // Ensure the filename has an extension
    if (!safeFilename.includes('.')) {
      const ext = contentType.includes('png') ? 'png'
        : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
        : contentType.includes('gif') ? 'gif'
        : contentType.includes('svg') ? 'svg'
        : 'webp';
      safeFilename = `${safeFilename}.${ext}`;
    }

    // Buffer the image data for guaranteed complete write into Cloudflare Edge Cache
    const imageBuffer = await response.arrayBuffer();

    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'Content-Disposition': `inline; filename="${safeFilename}"`,
      'Access-Control-Allow-Origin': '*',
      'X-Gamegata-Cache': 'MISS',
      'X-Upstream-Cache': upstreamCfCache,
    });

    const resToReturn = new Response(imageBuffer, {
      status: 200,
      headers: responseHeaders,
    });

    // Write to Cloudflare Edge Cache
    if (cache && cacheKey) {
      try {
        const resToCache = new Response(imageBuffer.slice(0), {
          status: 200,
          headers: responseHeaders,
        });
        await cache.put(cacheKey, resToCache);
      } catch (e) {
        console.error("[ImageProxy Cache Put Error]", e);
      }
    }

    return resToReturn;
  } catch (error) {
    console.error('Image proxy failed:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
