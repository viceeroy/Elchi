import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192x192.png', 'icon-512x512.png', 'icon-maskable-512x512.png'],
      manifest: {
        name: 'Elchi',
        short_name: 'Elchi',
        description: "Sayohatchilar va pochta yubormoqchi bo'lganlarni bog'lovchi bepul e'lon taxtasi.",
        theme_color: '#1B2A4A',
        background_color: '#EDE9DC',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  // Dev only — `vite` serves the app but not api/, which are Vercel functions.
  // Point /api at a `vercel dev` running alongside so the feed has a backend.
  // Override the port with ELCHI_API_PROXY. No effect on `vite build`.
  server: {
    proxy: {
      '/api': {
        target: process.env.ELCHI_API_PROXY || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
