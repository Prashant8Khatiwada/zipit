import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@zipit/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'ES2022',
  },
  optimizeDeps: {
    exclude: ['@zipit/core'],
  },
  worker: {
    format: 'es',
  },
});
