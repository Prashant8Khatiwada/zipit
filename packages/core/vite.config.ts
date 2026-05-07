import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      staticImport: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ZipItCore',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['fflate', 'streamsaver'],
      output: {
        globals: {
          fflate: 'fflate',
          streamsaver: 'streamsaver',
        },
      },
    },
    target: 'ES2022',
    sourcemap: true,
    minify: false,
  },
  worker: {
    format: 'es',
  },
});
