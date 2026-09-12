// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';
import sanity from '@sanity/astro';
import { ensureLocalDbBridge } from './src/lib/localDbBridge';

// Automatically boot local SQLite bridge for local development if remote database is omitted
ensureLocalDbBridge();

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    sanity({
      projectId: process.env.PUBLIC_SANITY_PROJECT_ID || 'b85krrfu',
      dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
      apiVersion: '2026-03-01',
      useCdn: true,
    })
  ],
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-dom/server',
        'drizzle-orm',
        'drizzle-orm/d1',
        'drizzle-orm/libsql',
        'drizzle-orm/sqlite-core',
        '@libsql/client/web',
        'better-auth',
        'better-auth/adapters/drizzle',
        '@sanity/client',
        'clsx',
        'tailwind-merge',
        'lucide-react',
      ],
    },
  },

  adapter: cloudflare()
});