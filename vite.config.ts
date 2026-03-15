import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
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
  optimizeDeps: {
    include: ['react-router-dom', 'react-markdown', 'remark-gfm'],
  }
});
