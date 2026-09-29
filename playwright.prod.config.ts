import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas del build de producción: compila todo y levanta un solo proceso (API + app compilada
 * con su service worker), como en el servidor. Base propia `data/e2e-prod.db`, recreada con el seed.
 *   pnpm e2e:prod
 */
const PORT = 3102

export default defineConfig({
  testDir: './e2e/prod',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    // Las pruebas de este proyecto necesitan el service worker.
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: [
      'pnpm build',
      'cd apps/api',
      'NODE_ENV=test pnpm exec tsx src/db/seed/index.ts --reset',
      // http://127.0.0.1 no es HTTPS: la cookie de sesión no puede exigirlo aquí.
      'NODE_ENV=production COOKIE_SECURE=false node dist/server.mjs',
    ].join(' && '),
    url: `http://127.0.0.1:${PORT}/api/system/health`,
    env: {
      PORT: String(PORT),
      DATABASE_PATH: './data/e2e-prod.db',
      OPEN_FOOD_FACTS: 'false',
    },
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
  },
})
