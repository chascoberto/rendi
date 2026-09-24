import { serve } from '@hono/node-server'
import { createApp } from './app'
import { env } from './env'

const app = createApp()

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  console.log(`Rendi API escuchando en http://${info.address}:${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
