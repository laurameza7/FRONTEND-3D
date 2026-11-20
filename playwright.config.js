import { defineConfig, devices } from '@playwright/test';

// Pruebas de extremo a extremo (npm run e2e): abren la aplicación real en Chromium.
// La API del backend se simula con datos reales del campus (e2e/datos), así no dependen de Render.
export default defineConfig({
  testDir: 'e2e',
  // En GitHub Actions no hay GPU: el 3D se dibuja por software (SwiftShader) y todo va más lento,
  // por eso allá se corre una prueba a la vez y con más tiempo de espera.
  timeout: process.env.CI ? 180_000 : 60_000,
  expect: { timeout: process.env.CI ? 45_000 : 15_000 },
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5180',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 760 } }, testIgnore: /movil\.spec/ },
    { name: 'celular', use: { ...devices['Pixel 7'] }, testMatch: /movil\.spec/ },
  ],
  webServer: {
    command: 'npx vite --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
  },
});
