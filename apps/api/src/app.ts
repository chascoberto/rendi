import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { z } from 'zod'
import type { Db } from './db/client'
import type { AppConfig, AppEnv } from './lib/context'
import { csrfProtection } from './lib/csrf'
import { handleError, notFound } from './lib/errors'
import { authRoutes } from './modules/auth/routes'
import { catalogRoutes } from './modules/catalog/routes'
import { householdRoutes } from './modules/household/routes'
import { systemRoutes } from './modules/system/routes'

z.config(z.locales.es())

export interface AppDeps {
  db: Db
  config: AppConfig
  /** Log de cada request (desactivado en tests). */
  logRequests?: boolean
}

/** Composición de rutas. El tipo `AppType` alimenta el cliente RPC del frontend. */
export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>().basePath('/api')
  if (deps.logRequests ?? true) app.use(logger())

  return app
    .use(async (c, next) => {
      c.set('db', deps.db)
      c.set('config', deps.config)
      await next()
    })
    .use(csrfProtection)
    .onError(handleError)
    .notFound((c) => handleError(notFound('Ruta no encontrada'), c))
    .route('/system', systemRoutes)
    .route('/auth', authRoutes)
    .route('/household', householdRoutes)
    .route('/catalog', catalogRoutes)
}

export type AppType = ReturnType<typeof createApp>
