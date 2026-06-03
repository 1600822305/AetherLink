import { defineConfig } from 'vitest/config';

// Standalone Vitest config kept separate from vite.config.ts so unit tests
// run in a lightweight Node environment without the app's build plugins
// (SolidJS / React / image-optimizer). Tests target pure logic modules.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
});
