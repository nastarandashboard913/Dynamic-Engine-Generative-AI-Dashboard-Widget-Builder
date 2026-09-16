
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on one origin: no CORS preflight on the SSE stream.
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})
