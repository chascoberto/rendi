import type { Db } from '../db/client'

/** Dependencias disponibles en cada request vía `c.var`. */
export interface AppEnv {
  Variables: {
    db: Db
  }
}
