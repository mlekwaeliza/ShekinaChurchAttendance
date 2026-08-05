import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const modulePath = id.replace(/\\/g, '/');
          if (modulePath.includes('/lucide-react/')) return 'icons';
          if (modulePath.includes('/@sentry/')) return 'observability';
          if (modulePath.includes('/@tanstack/react-query/')) return 'data-query';
          if (
            modulePath.includes('/react/') ||
            modulePath.includes('/react-dom/') ||
            modulePath.includes('/react-router/') ||
            modulePath.includes('/react-router-dom/')
          )
            return 'react-vendor';
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
    format: 'es',
    rollupOptions: {
      external: ['html2canvas'],
      output: {
        globals: {
          html2canvas: 'html2canvas'
        }
      }
    }
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
