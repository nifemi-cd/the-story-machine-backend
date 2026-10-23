import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // so the path aliases from tsconfig work in tests
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    // two groups of tests, run on their own with --project unit / --project e2e
    // or together. running them together gives one coverage report for both
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          // starting the in memory mongo can be slow, the first run also has to download it
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      // count every source file, even ones no test loads, so the % is honest
      include: ['src/**/*.ts'],
      // main.ts only starts the server, the e2e tests run the same setup through app.setup.ts
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
    },
  },
});
