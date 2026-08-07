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
      dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
      exclude: ['better-auth', '@libsql/client', 'styled-components'],
    },
    ssr: {
      external: ['better-auth', '@libsql/client', '@libsql/hrana-client'],
      noExternal: [],
    },
  },

  adapter: cloudflare()
});