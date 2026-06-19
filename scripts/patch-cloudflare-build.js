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
(function patchEsbuildAliases() {
  const bundleServerPath = path.join(
    nodeModules,
    '@opennextjs/cloudflare/dist/cli/build/bundle-server.js'
  );

  if (!fs.existsSync(bundleServerPath)) {
    console.log('[patch] bundle-server.js not found, skipping');
    return;
  }

  let code = fs.readFileSync(bundleServerPath, 'utf-8');

  // Check if already patched
  if (code.includes('"pg-cloudflare"')) {
    console.log('[patch] esbuild aliases already applied, skipping');
    return;
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
    return;
  }

  const insertPos = aliasIdx + aliasMarker.length;
  const aliasInsert = '\n            ' + aliases.join(',\n            ') + ',';
  code = code.slice(0, insertPos) + aliasInsert + code.slice(insertPos);

  fs.writeFileSync(bundleServerPath, code, 'utf-8');
  console.log(`[patch] Added ${aliases.length} esbuild aliases: ${aliases.map(a => a.split('"')[1]).join(', ')}`);
})();

// --- Patch bundle-server.js: externalize "next" from esbuild bundle ---
// The handler.mjs bundles the entire Next.js runtime (~11 MB). But nft has already
// traced all next dependencies into _worker.js/node_modules/next/. We avoid this
// duplication by keeping "next" external — at runtime it resolves from the traced
// (and patched) node_modules instead.
(function patchEsbuildExternal() {
  const bundleServerPath = path.join(
    nodeModules,
    '@opennextjs/cloudflare/dist/cli/build/bundle-server.js'
  );

  if (!fs.existsSync(bundleServerPath)) {
    console.log('[patch] bundle-server.js not found, skipping external patch');
    return;
  }

  let code = fs.readFileSync(bundleServerPath, 'utf-8');

  const oldExternal = 'external: ["./middleware/handler.mjs"]';
  const newExternal = 'external: ["./middleware/handler.mjs", "next"]';

  if (code.includes(newExternal)) {
    console.log('[patch] esbuild external already includes "next", skipping');
    return;
  }

  if (!code.includes(oldExternal)) {
    console.warn('[patch] WARNING: Could not find external array in bundle-server.js');
    return;
  }

  code = code.replace(oldExternal, newExternal);
  fs.writeFileSync(bundleServerPath, code, 'utf-8');
  console.log('[patch] Added "next" to esbuild external — handler.mjs will import from traced node_modules');
})();

// --- Patch copyTracedFiles.js: handle Windows EPERM on symlink ---
const copyTracedPath = path.join(
  nodeModules,
  '@opennextjs/aws/dist/build/copyTracedFiles.js'
);

if (fs.existsSync(copyTracedPath)) {
  let copyCode = fs.readFileSync(copyTracedPath, 'utf-8');
  if (!copyCode.includes('EPERM')) {
    // On Windows, symlink requires admin/Developer Mode. Fall back to copy.
    copyCode = copyCode.replace(
      `if (e.code !== "EEXIST") {\n                    throw e;\n                }`,
      `if (e.code !== "EEXIST" && e.code !== "EPERM") {\n                    throw e;\n                } else if (e.code === "EPERM") {\n                    try { copyFileAndMakeOwnerWritable(from, to); } catch (e2) { erroredFiles.push(to); }\n                }`
    );
    fs.writeFileSync(copyTracedPath, copyCode, 'utf-8');
    console.log('[patch] Patched copyTracedFiles.js: symlink fallback to copy on EPERM');
  } else {
    console.log('[patch] copyTracedFiles.js already patched for EPERM');
  }
} else {
  console.warn('[patch] copyTracedFiles.js not found, skipping symlink patch');
}

console.log('[patch] All patches applied successfully');
