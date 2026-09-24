import { dirname } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { env } from './env'

const db = createDb(env.DATABASE_PATH)
const applied = runMigrations(db, {
  migrationsDir: env.MIGRATIONS_DIR,
  // En producción, respaldo automático antes de aplicar migraciones pendientes.
  backupDir: env.NODE_ENV === 'production' ? dirname(env.DATABASE_PATH) : undefined,
})
if (applied > 0) console.log(`Migraciones aplicadas: ${applied}`)

const app = createApp({ db })

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  console.log(`Rendi API escuchando en http://${info.address}:${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () =>
    server.close(() => {
      db.$client.close()
      process.exit(0)
    }),
  )
}
