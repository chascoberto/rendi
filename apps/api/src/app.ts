import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { Db } from './db/client'
import type { AppEnv } from './lib/context'
import { systemRoutes } from './modules/system/routes'

export interface AppDeps {
  db: Db
}

/** Composición de rutas. El tipo `AppType` alimenta el cliente RPC del frontend. */
export function createApp(deps: AppDeps) {
  return new Hono<AppEnv>()
    .basePath('/api')
    .use(logger())
    .use(async (c, next) => {
      c.set('db', deps.db)
      await next()
    })
    .route('/system', systemRoutes)
}

export type AppType = ReturnType<typeof createApp>
