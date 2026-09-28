import type { Db } from '../db/client'
import type { ProductLookup } from '../modules/catalog/lookup/types'
import type { SessionUser } from '../modules/auth/session'

/** Dependencias disponibles en cada request vía `c.var`. */
export interface AppEnv {
  Variables: {
    db: Db
    config: AppConfig
    /** Fuente externa de datos por código de barras (Open Food Facts o un doble en tests). */
    productLookup: ProductLookup
  }
}

/** Configuración de la app que dependen del entorno (inyectada para poder testear). */
export interface AppConfig {
  cookieSecure: boolean
}

/** Contexto de rutas protegidas: `requireAuth` garantiza `c.var.user`. */
export interface AuthEnv {
  Variables: AppEnv['Variables'] & {
    user: SessionUser
  }
}
