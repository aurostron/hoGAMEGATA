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
    '/_astro/*',
    '/catalog/*',
    '/icons/*',
    '/images/*',
    '/platforms/*',
    '/3rd-party/*',
    '/favicon.*',
    '/*.svg',
    '/*.png',
    '/*.jpg',
    '/*.gif',
    '/*.ico',
    '/*.txt',
    '/*.xml',
    '/*.json',
    '/sw.js',
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

    // 1. Try static assets first
    try {
      if (env.ASSETS) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) {
          return asset;
        }
      }
    } catch (e) {}

    // 2. Check Cloudflare Edge Cache for GET requests
    const CACHE_VERSION = 'hgg-v3';
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

    // 3. Route to Primary Node (gamegata.xyz)
    try {
      const clientIp = request.headers.get('cf-connecting-ip') || '';
      const primaryUrl = \`https://gamegata.xyz\${url.pathname}\${url.search}\`;
      const forwardReq = new Request(primaryUrl, {
        method: request.method,
        headers: {
          'Accept': request.headers.get('Accept') || '*/*',
          'User-Agent': 'HGG-Mirror-Agent/1.0',
          'X-HGG-Mirror': '1',
          'X-Forwarded-Host': url.hostname,
          ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
        },
      });

      const originRes = await fetch(forwardReq);

      if (originRes.ok) {
        const resHeaders = new Headers(originRes.headers);
        resHeaders.set('X-HGG-Mirror-Cache', 'MISS');
        resHeaders.set('X-HGG-Mirror-Origin', 'gamegata.xyz');
        resHeaders.set('Access-Control-Allow-Origin', '*');

        // Edge cache HTML and API responses for 24 hours
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
        if (url.pathname === '/' || url.pathname === '') {
          // Serve the offline search catalog directly
          const fallbackAsset = await env.ASSETS.fetch(new Request(\`\${url.origin}/search/index.html\`));
          if (fallbackAsset && fallbackAsset.status === 200) {
            return fallbackAsset;
          }
          return Response.redirect(\`\${url.origin}/search/\`, 302);
        }
        if (url.pathname.startsWith('/api/')) {
          return new Response(JSON.stringify({ games: [], totalCount: 0, isMirrorFallback: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return Response.redirect(\`\${url.origin}/search/\`, 302);
      }

      // If origin returns any other error (e.g. 404), pass it through
      return new Response(originRes.body, {
        status: originRes.status,
        headers: originRes.headers,
      });
    } catch (err) {
      // 4. Primary node unreachable: provide resilient fallback
      if (url.pathname === '/' || url.pathname === '') {
        return Response.redirect(\`\${url.origin}/search/\`, 302);
      }

      return new Response(
        \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>hoGAMEGATA Mirror — Primary Node Offline</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background: #000; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
    h1 { font-size: 2rem; font-weight: 200; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1rem; }
    p { color: #888; max-width: 480px; font-weight: 300; line-height: 1.6; margin-bottom: 2rem; }
    a { border: 1px solid #fff; color: #fff; padding: 14px 28px; text-decoration: none; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.2em; transition: 0.2s; }
    a:hover { background: #fff; color: #000; }
  </style>
</head>
<body>
  <h1>Mirror Protocol Active</h1>
  <p>The primary gamegata.xyz cluster is currently offline. The client-side preservation catalog is fully operational.</p>
  <a href="/search/">Browse 108,000+ Games</a>
</body>
</html>\`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }
  },
};
`;
fs.writeFileSync(path.join(mirrorDir, '_worker.js'), workerContent.trim());

// 7. Deploy to Cloudflare Pages
console.log('\n🚀 Deploying to Cloudflare Pages (project: hogamegata)...');
try {
  execSync(
    'npx wrangler pages deploy dist/mirror --project-name=hogamegata --commit-dirty=true',
    { stdio: 'inherit' }
  );
  console.log('\n🎉 Deployment to https://hogamegata.pages.dev completed successfully!');
} catch (e) {
  console.error('❌ Cloudflare Pages deployment failed:', e);
  process.exit(1);
}
