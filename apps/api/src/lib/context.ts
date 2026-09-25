import type { Db } from '../db/client'
import type { SessionUser } from '../modules/auth/session'

/** Dependencias disponibles en cada request vía `c.var`. */
export interface AppEnv {
  Variables: {
    db: Db
    config: AppConfig
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
