const fs = require('fs');
const path = require('path');

const openNextDir = path.join(__dirname, '../.open-next');
const assetsDir = path.join(openNextDir, 'assets');
const workerDir = path.join(assetsDir, '_worker.js');

console.log('Formatting OpenNext output for Cloudflare Pages Advanced Mode...');

// Create _worker.js directory
if (!fs.existsSync(workerDir)) {
  fs.mkdirSync(workerDir, { recursive: true });
}

// Move everything from .open-next to .open-next/assets/_worker.js, EXCEPT the 'assets' directory itself
const items = fs.readdirSync(openNextDir);
for (const item of items) {
  if (item === 'assets') continue;

  const src = path.join(openNextDir, item);
  const dest = path.join(workerDir, item);

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.renameSync(src, dest);
}

// Rename worker.js to index.js inside the _worker.js directory
const workerJsSrc = path.join(workerDir, 'worker.js');
const indexJsDest = path.join(workerDir, 'index.js');
if (fs.existsSync(workerJsSrc)) {
  fs.renameSync(workerJsSrc, indexJsDest);
} else {
  console.error('Error: .open-next/worker.js not found! Ensure opennext build succeeded.');
  process.exit(1);
}

// Reduce bundle size: Next.js bundles a 4.2 MB capsize-font-metrics.json
// with metrics for ALL Google Fonts. We only use Montserrat, so replace
// with an empty object. Font fallback adjustments may be slightly less
// precise but saves 4.2 MB of bundle size.
const fontMetricsPath = path.join(workerDir, 'server-functions/default/node_modules/next/dist/server/capsize-font-metrics.json');
let savedFontMB = 0;
if (fs.existsSync(fontMetricsPath)) {
  const origSize = fs.statSync(fontMetricsPath).size;
  fs.writeFileSync(fontMetricsPath, '{}\n', 'utf-8');
  savedFontMB = origSize / (1024 * 1024);
}

// Reduce bundle size: Replace the heavy 4.8 MB Prisma WASM query compiler
// with an empty shim. Since we are using Prisma Accelerate (prisma+postgres://),
// the client never instantiates the local WASM engine at runtime.
const prismaWasmPath = path.join(workerDir, 'server-functions/default/node_modules/.prisma/client/query_compiler_fast_bg.wasm-base64.js');
let savedPrismaMB = 0;
if (fs.existsSync(prismaWasmPath)) {
  const origSize = fs.statSync(prismaWasmPath).size;
  fs.writeFileSync(prismaWasmPath, 'const wasm = "";\nmodule.exports = { wasm };\n', 'utf-8');
  savedPrismaMB = origSize / (1024 * 1024);
}

// Reduce bundle size: Replace the heavy 534 KB onnxruntime-web Node.js runtime 
// file with an empty shim since Cloudflare Workers run in a V8 edge environment, 
// not Node.js, and load the web/WASM version instead.
const onnxNodePath = path.join(workerDir, 'server-functions/default/node_modules/onnxruntime-web/dist/ort-web.node.js');
let savedOnnxNodeMB = 0;
if (fs.existsSync(onnxNodePath)) {
  const origSize = fs.statSync(onnxNodePath).size;
  fs.writeFileSync(onnxNodePath, 'module.exports = {};\n', 'utf-8');
  savedOnnxNodeMB = origSize / (1024 * 1024);
}

const totalSaved = (savedFontMB + savedPrismaMB + savedOnnxNodeMB).toFixed(2);
console.log(`Done! Pruned assets (saved ${totalSaved} MB: ${savedFontMB.toFixed(2)} MB fonts + ${savedPrismaMB.toFixed(2)} MB Prisma WASM + ${savedOnnxNodeMB.toFixed(2)} MB ONNX Node) → assets/_worker.js/index.js`);


