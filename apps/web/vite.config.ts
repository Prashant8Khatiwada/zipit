import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@khatiwadaprashant/zipit/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'ES2022',
  },
  optimizeDeps: {
    exclude: ['@khatiwadaprashant/zipit/core'],
  },
  worker: {
    format: 'es',
  },
});
