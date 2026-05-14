import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'download.worker': resolve(__dirname, 'src/workers/download.worker.ts'),
        'zip.worker': resolve(__dirname, 'src/workers/zip.worker.ts'),
      },
      name: 'ZipItCore',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['fflate'],
      output: {
        globals: {
          fflate: 'fflate',
        },
      },
    },
    target: 'ES2022',
    sourcemap: true,
    minify: false,
  },
});
