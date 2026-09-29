import { dirname } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { openFoodFactsLookup } from './modules/catalog/lookup/openfoodfacts'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { env } from './env'
import { findWebDir, withWebApp } from './web'

const db = createDb(env.DATABASE_PATH)
const applied = runMigrations(db, {
  migrationsDir: env.MIGRATIONS_DIR,
  // En producción, respaldo automático antes de aplicar migraciones pendientes.
  backupDir: env.NODE_ENV === 'production' ? dirname(env.DATABASE_PATH) : undefined,
})
if (applied > 0) console.log(`Migraciones aplicadas: ${applied}`)

const app = createApp({
  db,
  config: { cookieSecure: env.COOKIE_SECURE },
  productLookup: env.OPEN_FOOD_FACTS ? openFoodFactsLookup() : undefined,
})

const webDir = findWebDir(env.WEB_DIST_DIR || undefined)
const handler = webDir ? withWebApp(app, webDir) : app

const server = serve({ fetch: handler.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  const what = webDir ? 'Rendi (API y app)' : 'Rendi API'
  console.log(`${what} escuchando en http://${info.address}:${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () =>
    server.close(() => {
      db.$client.close()
      process.exit(0)
    }),
  )
}
