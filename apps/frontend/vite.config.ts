import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Public base path. Defaults to '/' for local dev; CI sets BASE_PATH to the
  // GitHub Pages subpath (e.g. '/Geobiograph.io/'). Vite exposes this to the app
  // as import.meta.env.BASE_URL, which the router uses as its basename.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the Express backend in dev (avoids CORS).
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
