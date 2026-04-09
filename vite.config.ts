/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    {
      name: 'react-jsx-runtime-workaround',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') {
          return '\0' + id;
        }
      },
      load(id) {
        if (id === '\0react/jsx-runtime' || id === '\0react/jsx-dev-runtime') {
          return `
            import React from 'react';
            export const jsx = React.createElement;
            export const jsxs = React.createElement;
            export const jsxDEV = React.createElement;
            export const Fragment = React.Fragment;
          `;
        }
      }
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['Logo.png', 'icon-192.png', 'icon-512.png', 'offline.html'],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
      },
      manifest: {
        name: "ORIS - Open Response and Investigation System",
        short_name: "ORIS",
        description: "Open Response and Investigation System for incident management and case tracking",
        theme_color: "#1e2937",
        background_color: "#1e2937",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "fr",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        screenshots: [
          {
            src: '/image.png',
            sizes: '1355x857',
            type: 'image/png',
            form_factor: 'wide'
          },
          {
            src: '/image.png',
            sizes: '1355x857',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ],
        categories: ["productivity", "utilities"],
        prefer_related_applications: false
      }
    })
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router-dom/') || id.includes('react-helmet-async/')) return 'react-vendor';
            if (id.includes('lucide-react/') || id.includes('framer-motion/') || id.includes('tippy.js/')) return 'ui-vendor';
            if (id.includes('@tiptap/') || id.includes('prosemirror')) return 'editor-vendor';
            if (id.includes('@xyflow/') || id.includes('dagre')) return 'graph-vendor';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n-vendor';
            if (id.includes('dompurify') || id.includes('marked')) return 'sanitize-vendor';
            return 'vendor';
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react-router-dom', 'react-markdown', 'remark-gfm'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  }
});
