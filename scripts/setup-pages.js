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
if (fs.existsSync(fontMetricsPath)) {
  const origSize = fs.statSync(fontMetricsPath).size;
  fs.writeFileSync(fontMetricsPath, '{}\n', 'utf-8');
  const savedMB = (origSize / (1024 * 1024)).toFixed(2);
  console.log(`Done! Worker, dependencies + removed ${savedMB} MB font metrics → assets/_worker.js/index.js`);
} else {
  console.log('Done! Worker and dependencies packaged to assets/_worker.js/index.js');
}
