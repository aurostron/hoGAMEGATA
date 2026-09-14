import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const distClientDir = path.join(rootDir, 'dist', 'client');
const mirrorDir = path.join(rootDir, 'dist', 'mirror');

console.log('==================================================');
console.log('🌐 hoGAMEGATA Cloudflare Pages Mirror Deployer');
console.log('   Target: hogamegata.pages.dev');
console.log('==================================================\n');

// 1. Ensure dist/client exists
if (!fs.existsSync(distClientDir)) {
  console.log('📦 dist/client not found. Running build...');
  execSync('npm run build', { stdio: 'inherit' });
}

// 2. Prepare dist/mirror directory
console.log('📁 Preparing dist/mirror workspace...');
if (fs.existsSync(mirrorDir)) {
  fs.rmSync(mirrorDir, { recursive: true, force: true });
}
fs.mkdirSync(mirrorDir, { recursive: true });

// 3. Copy static assets from dist/client to dist/mirror
console.log('📋 Copying static assets from dist/client to dist/mirror...');
fs.cpSync(distClientDir, mirrorDir, { recursive: true });

// 4. Create _routes.json to route static assets directly to CDN and dynamic routes to _worker.js
console.log('⚙️ Generating _routes.json...');
const routesConfig = {
  version: 1,
  include: ['/*'],
  exclude: [
    '/catalog/*',
    '/icons/*',
    '/images/*',
    '/platforms/*',
    '/3rd-party/*',
    '/favicon.ico',
    '/favicon.svg',
    '/manifest.json',
    '/sw.js',
    '/robots.txt',
    '/sitemap-index.xml',
    '/sitemap-0.xml',
  ],
};
fs.writeFileSync(path.join(mirrorDir, '_routes.json'), JSON.stringify(routesConfig, null, 2));

// 5. Create _headers for security and caching
console.log('🛡️ Generating _headers...');
const headersContent = `
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Access-Control-Allow-Origin: *

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/catalog/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
`;
fs.writeFileSync(path.join(mirrorDir, '_headers'), headersContent.trim());

// 6. Generate _worker.js
console.log('⚡ Generating _worker.js edge proxy & cache handler...');
const workerContent = `
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Fast redirect: Remove /search completely
    if (url.pathname === '/search' || url.pathname === '/search/') {
      return Response.redirect(\`\${url.origin}/\`, 301);
    }

    // 1. Dedicated handler for /_astro/* assets (CSS/JS chunks)
    // Guarantees styles and scripts NEVER 404 even across version mismatches
    if (url.pathname.startsWith('/_astro/')) {
      try {
        if (env.ASSETS) {
          const asset = await env.ASSETS.fetch(request);
          if (asset && asset.status === 200) {
            return asset;
          }
        }
      } catch (e) {}

      try {
        const originAssetUrl = \`https://gamegata.xyz\${url.pathname}\`;
        const originAssetRes = await fetch(originAssetUrl);
        if (originAssetRes.ok) {
          const resHeaders = new Headers(originAssetRes.headers);
          resHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
          resHeaders.set('Access-Control-Allow-Origin', '*');
          return new Response(originAssetRes.body, { status: 200, headers: resHeaders });
        }
      } catch (e) {}
    }

    // 2. Try static assets first
    try {
      if (env.ASSETS) {
        const asset = await env.ASSETS.fetch(request);
        if (asset && asset.status === 200) {
          return asset;
        }
      }
    } catch (e) {}

    // 3. Check Cloudflare Edge Cache for GET requests
    const CACHE_VERSION = 'hgg-v5';
    const cache = typeof caches !== 'undefined' && caches.default;
    const cleanUrl = new URL(request.url);
    const cacheKeyUrl = \`\${cleanUrl.origin}\${cleanUrl.pathname}\${cleanUrl.search}?_cv=\${CACHE_VERSION}\`;
    const cacheKey = new Request(cacheKeyUrl, { method: 'GET' });

    if (cache && request.method === 'GET') {
      try {
        const cachedRes = await cache.match(cacheKey);
        if (cachedRes) {
          const hitRes = new Response(cachedRes.body, cachedRes);
          hitRes.headers.set('X-HGG-Mirror-Cache', 'HIT');
          return hitRes;
        }
      } catch (e) {}
    }

    // 4. Dedicated handler for Image Proxy (/api/image-proxy/*)
    // Ensures covers and screenshots always load and are cached, with direct fallback
    if (url.pathname.startsWith('/api/image-proxy')) {
      const targetUrl = url.searchParams.get('url');
      if (targetUrl) {
        // Try origin first
        try {
          const primaryUrl = \`https://gamegata.xyz\${url.pathname}\${url.search}\`;
          const originRes = await fetch(primaryUrl, {
            headers: {
              'User-Agent': 'HGG-Mirror-Agent/1.0',
              'Accept': request.headers.get('Accept') || 'image/*,*/*',
            },
          });
          if (originRes.ok) {
            const resHeaders = new Headers(originRes.headers);
            resHeaders.set('X-HGG-Mirror-Cache', 'MISS');
            resHeaders.set('Access-Control-Allow-Origin', '*');
            resHeaders.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
            const imgRes = new Response(originRes.body, { status: 200, headers: resHeaders });
            if (cache && ctx && ctx.waitUntil) {
              ctx.waitUntil(cache.put(cacheKey, imgRes.clone()));
            }
            return imgRes;
          }
        } catch (e) {}

        // Fallback: direct fetch for whitelisted image hosts
        try {
          const parsed = new URL(targetUrl);
          const ALLOWED_HOSTS = [
            'images.igdb.com', 'media.rawg.io', 'rawg.io', 'img.itch.zone', 'itch.zone',
            'img.itch.io', 'itch.io', 'static.itch.io', 'steamstatic.com', 'steampowered.com',
            'media.steampowered.com', 'shared.cloudflare.steamstatic.com', 'shared.akamai.steamstatic.com',
            'cdn.akamai.steamstatic.com', 'images-common.gog-statics.com', 'gog-statics.com',
            'iili.io', 'freeimage.host', 'catbox.moe', 'files.catbox.moe', 'res.cloudinary.com',
            'imgur.com', 'i.imgur.com', 'postimg.cc', 'i.postimg.cc', 'postimages.org',
            'youtube.com', 'img.youtube.com', 'i.ytimg.com'
          ];
          const isAllowed = ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
          if (isAllowed) {
            const fetchHeaders = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            };
            if (parsed.hostname.includes('itch')) {
              fetchHeaders['Referer'] = 'https://itch.io/';
            }
            const directRes = await fetch(targetUrl, { headers: fetchHeaders });
            if (directRes.ok) {
              const contentType = directRes.headers.get('Content-Type') || 'image/jpeg';
              const imgRes = new Response(directRes.body, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
                  'Access-Control-Allow-Origin': '*',
                  'X-HGG-Mirror-Direct': '1',
                },
              });
              if (cache && ctx && ctx.waitUntil) {
                ctx.waitUntil(cache.put(cacheKey, imgRes.clone()));
              }
              return imgRes;
            }
          }
        } catch (e) {}
      }
    }

    // 5. Route to Primary Site (gamegata.xyz)
    try {
      const clientIp = request.headers.get('cf-connecting-ip') || '';
      const primaryUrl = \`https://gamegata.xyz\${url.pathname}\${url.search}\`;
      
      const forwardHeaders = new Headers(request.headers);
      forwardHeaders.set('User-Agent', 'HGG-Mirror-Agent/1.0');
      forwardHeaders.set('X-HGG-Mirror', '1');
      forwardHeaders.set('X-Forwarded-Host', url.hostname);
      if (clientIp) {
        forwardHeaders.set('X-Forwarded-For', clientIp);
      }

      const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
      const forwardReq = new Request(primaryUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: hasBody ? request.body : undefined,
        duplex: hasBody ? 'half' : undefined,
      });

      const originRes = await fetch(forwardReq);

      if (originRes.ok) {
        const resHeaders = new Headers(originRes.headers);
        resHeaders.set('X-HGG-Mirror-Cache', 'MISS');
        resHeaders.set('X-HGG-Mirror-Origin', 'gamegata.xyz');
        resHeaders.set('Access-Control-Allow-Origin', '*');

        // Edge cache HTML and API responses
        resHeaders.set(
          'Cache-Control',
          'public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800'
        );

        const mirrorRes = new Response(originRes.body, {
          status: originRes.status,
          statusText: originRes.statusText,
          headers: resHeaders,
        });

        // Put in edge cache
        if (cache && request.method === 'GET' && ctx && ctx.waitUntil) {
          ctx.waitUntil(cache.put(cacheKey, mirrorRes.clone()));
        }

        return mirrorRes;
      }

      // If origin returns an error (e.g. rate limit 429, database quota exceeded 500, or temporary outage)
      if (originRes.status >= 500 || originRes.status === 429) {
        if (url.pathname.startsWith('/api/')) {
          return new Response(JSON.stringify({ games: [], totalCount: 0, isMirrorFallback: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return Response.redirect(\`\${url.origin}/\`, 302);
      }

      // If origin returns any other error (e.g. 404), pass it through
      return new Response(originRes.body, {
        status: originRes.status,
        headers: originRes.headers,
      });
    } catch (err) {
      // 6. Primary site unreachable: provide resilient fallback
      return Response.redirect(\`\${url.origin}/\`, 302);
    }
  },
};
`;
fs.writeFileSync(path.join(mirrorDir, '_worker.js'), workerContent.trim());

// 7. Deploy to Cloudflare Pages
console.log('\n🚀 Deploying to Cloudflare Pages (project: hogamegata)...');
try {
  // Clear any cached worker deploy configs that interfere with Pages deploy
  const wranglerDeployDir = path.join(rootDir, '.wrangler', 'deploy');
  if (fs.existsSync(wranglerDeployDir)) {
    fs.rmSync(wranglerDeployDir, { recursive: true, force: true });
  }

  execSync(
    'npx wrangler pages deploy dist/mirror --project-name=hogamegata --commit-dirty=true --no-bundle',
    { stdio: 'inherit' }
  );
  console.log('\n🎉 Deployment to https://hogamegata.pages.dev completed successfully!');
} catch (e) {
  console.error('❌ Cloudflare Pages deployment failed:', e);
  process.exit(1);
}
