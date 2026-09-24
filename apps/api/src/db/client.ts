import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type Db = ReturnType<typeof createDb>

/** Abre (o crea) la base SQLite con los pragmas del proyecto. Acepta ':memory:' para tests. */
export function createDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return drizzle({ client: sqlite, schema, casing: 'snake_case' })
}

/** Transacción de Drizzle; los servicios aceptan `DbOrTx` para poder componerse dentro de otra. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx
