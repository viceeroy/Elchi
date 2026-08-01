import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
