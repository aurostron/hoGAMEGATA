const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../.open-next/server-functions/default/handler.mjs');

if (!fs.existsSync(filePath)) {
  console.error(`[Patch] Error: File not found at ${filePath}`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Match the throw statement for the instrumentation hook error
const searchRegex = /throw\s+Object\.defineProperty\(\s*new\s+Error\(\s*['"]An error occurred while loading the instrumentation hook['"]/g;

if (searchRegex.test(content)) {
  content = content.replace(searchRegex, 'return; $&');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[Patch] Successfully patched handler.mjs to bypass the instrumentation hook error.');
} else {
  console.warn('[Patch] Warning: Could not find the instrumentation hook error throw statement in handler.mjs.');
}
