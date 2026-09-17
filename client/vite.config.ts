
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          if (id.includes('@radix-ui') || id.includes('@floating-ui') || id.includes('aria-hidden') || id.includes('react-remove-scroll')) return 'vendor-radix'
          if (id.includes('/zod/')) return 'vendor-zod'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('@tanstack')) return 'vendor-virtual'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react'
          return 'vendor-misc'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on one origin: no CORS preflight on the SSE stream.
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})
