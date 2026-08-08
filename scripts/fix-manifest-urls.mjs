/**
 * Post-build script: Fix Windows file:/// URLs in Astro's serialized manifest
 * that cause "Invalid URL string" errors on Cloudflare Workers.
 * 
 * The Cloudflare Workers runtime cannot parse file:///C:/... style URLs.
 * This replaces them with file:///placeholder/ URLs that satisfy the URL constructor
 * without breaking functionality (these dirs aren't accessed at runtime on CF Workers).
 */
import { readFileSync, writeFileSync } from 'fs';

const entryPath = 'dist/server/entry.mjs';
let content = readFileSync(entryPath, 'utf8');

// Count replacements
let count = 0;

// Replace all file:///C:/... or file:///D:/... URLs in the serialized manifest
// with a valid placeholder file:///app/ URL
content = content.replace(/"file:\/\/\/[A-Z]:\/[^"]*\/gamegata-astro\/([^"]*)"/g, (match, subpath) => {
  count++;
  return `"file:///app/${subpath}"`;
});

if (count > 0) {
  writeFileSync(entryPath, content, 'utf8');
  console.log(`✅ Fixed ${count} Windows file:/// URLs in ${entryPath}`);
} else {
  console.log('ℹ️ No Windows file:/// URLs found — nothing to fix.');
}
