import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.worker.ts', 'src/index.ts'],
      thresholds: {
        global: {
          functions: 90,
          branches: 85,
          lines: 90,
        },
      },
    },
  },
});
