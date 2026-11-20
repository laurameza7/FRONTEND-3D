import { defineConfig } from 'vite';

export default defineConfig({
  build: { chunkSizeWarningLimit: 900 },
  // Unit tests (npm test): simulated DOM with jsdom
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
