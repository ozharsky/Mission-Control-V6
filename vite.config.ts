import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Mission-Control-V6/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor libraries
          'vendor': ['react', 'react-dom'],
          // Charts
          'charts': ['recharts'],
          // Icons
          'icons': ['lucide-react'],
        },
        // Ensure chunk names are predictable
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 600,
  },
})
