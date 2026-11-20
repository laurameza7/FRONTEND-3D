import { defineConfig } from 'vite';

export default defineConfig({
  build: { chunkSizeWarningLimit: 900 },
  // Pruebas unitarias (npm test): DOM simulado con jsdom
  test: {
    environment: 'jsdom',
    include: ['pruebas/**/*.test.js'],
  },
});
