import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('jspdf-autotable')) return 'report-autotable';
          if (id.includes('jspdf')) return 'report-pdf';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('react') || id.includes('react-router-dom')) return 'react-vendor';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        }
      }
    }
  },
  // FFA P2: Web Worker for report-pdf generation. ESM format is
  // required for the worker to use import statements (jspdf +
  // jspdf-autotable are ESM). The default 'iife' format doesn't
  // support code splitting which the worker needs.
  worker: {
    format: 'es'
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  }
});
