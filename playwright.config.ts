import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas end-to-end en un Chromium con tamaño de celular.
 * Levantan su propia API (puerto 3101, base data/e2e.db recreada con el seed) y su propio
 * Vite (puerto 5174), así que pueden correr con `pnpm dev` abierto.
 *   pnpm e2e           → pruebas
 *   pnpm e2e:screens   → capturas claro/oscuro en test-results/screens (revisión visual)
 */
const API_PORT = 3101
const WEB_PORT = 5174
const screens = !!process.env.SCREENS

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  grep: screens ? /@screens/ : undefined,
  grepInvert: screens ? undefined : /@screens/,
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      cwd: 'apps/api',
      command: 'pnpm exec tsx src/db/seed/index.ts --reset && pnpm exec tsx src/server.ts',
      url: `http://127.0.0.1:${API_PORT}/api/system/health`,
      env: { NODE_ENV: 'test', PORT: String(API_PORT), DATABASE_PATH: './data/e2e.db' },
      reuseExistingServer: false,
      stdout: 'ignore',
    },
    {
      cwd: 'apps/web',
      command: 'pnpm exec vite',
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { WEB_PORT: String(WEB_PORT), API_URL: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
})
