// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';
import sanity from '@sanity/astro';

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
      dedupe: ['react', 'react-dom', 'lucide-react']
    },
    ssr: {
      noExternal: ['lucide-react', 'react', 'react-dom']
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/server',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        '@sanity/client',
        'drizzle-orm',
        'drizzle-orm/libsql',
        'drizzle-orm/sqlite-core',
        '@libsql/client/web',
        'better-auth',
        'better-auth/adapters/drizzle',
      ]
    }
  },

  adapter: cloudflare()
});