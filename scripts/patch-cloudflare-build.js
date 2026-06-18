/**
 * Pre-build script that patches @opennextjs/cloudflare's bundle-server.js
 * to fix two esbuild errors on Cloudflare Pages:
 *
 * 1. `pg-cloudflare` resolution failure:
 *    pg's dynamic require('pg-cloudflare') isn't traced by nft, so the .open-next
 *    copy is missing dist/index.js. We alias it to the project root's node_modules.
 *
 * 2. `onnxruntime-node` native .node binary:
 *    @xenova/transformers statically imports onnxruntime-node which contains native
 *    binaries. We alias it to an empty shim. On Cloudflare Workers (no process.release.name === 'node'),
 *    @xenova/transformers falls back to onnxruntime-web (WASM).
 */
const fs = require('fs');
const path = require('path');

const nodeModules = path.join(__dirname, '../node_modules');

// --- Patch bundle-server.js: add esbuild aliases ---
const bundleServerPath = path.join(
  nodeModules,
  '@opennextjs/cloudflare/dist/cli/build/bundle-server.js'
);

if (!fs.existsSync(bundleServerPath)) {
  console.log('[patch] bundle-server.js not found, skipping');
  process.exit(0);
}

let code = fs.readFileSync(bundleServerPath, 'utf-8');

// Check if already patched
if (code.includes('"pg-cloudflare"')) {
  console.log('[patch] Already patched, skipping');
  process.exit(0);
}

const aliases = [];

// pg-cloudflare: resolve from project root node_modules
const pgCloudflareIndex = path.join(nodeModules, 'pg-cloudflare/dist/index.js');
if (fs.existsSync(pgCloudflareIndex)) {
  aliases.push(`"pg-cloudflare": ${JSON.stringify(pgCloudflareIndex)}`);
} else {
  console.warn('[patch] WARNING: pg-cloudflare/dist/index.js not found in node_modules');
}

// onnxruntime-node: empty shim. @xenova/transformers checks process.release.name
// to choose between onnxruntime-node (native) and onnxruntime-web (WASM).
// On Cloudflare Workers, the node check fails, so it uses onnxruntime-web.
const emptyShimPath = path.join(__dirname, '../.open-next-temp/empty-onnx-shim.js');
const tempDir = path.dirname(emptyShimPath);
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(emptyShimPath)) {
  fs.writeFileSync(emptyShimPath, 'module.exports = {};\n', 'utf-8');
}
aliases.push(`"onnxruntime-node": ${JSON.stringify(emptyShimPath)}`);

// Find the alias: { ... } block and inject
const aliasMarker = 'alias: {';
const aliasIdx = code.indexOf(aliasMarker);

if (aliasIdx === -1) {
  console.error('[patch] Could not find alias block in bundle-server.js');
  process.exit(1);
}

const insertPos = aliasIdx + aliasMarker.length;
const aliasInsert = '\n            ' + aliases.join(',\n            ') + ',';
code = code.slice(0, insertPos) + aliasInsert + code.slice(insertPos);

fs.writeFileSync(bundleServerPath, code, 'utf-8');
console.log(`[patch] Added ${aliases.length} esbuild aliases: ${aliases.map(a => a.split('"')[1]).join(', ')}`);
console.log('[patch] All patches applied successfully');
