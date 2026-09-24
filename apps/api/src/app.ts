import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { systemRoutes } from './modules/system/routes'

/** Composición de rutas. El tipo `AppType` alimenta el cliente RPC del frontend. */
export function createApp() {
  return new Hono().basePath('/api').use(logger()).route('/system', systemRoutes)
}

export type AppType = ReturnType<typeof createApp>
