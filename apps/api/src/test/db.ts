import { fileURLToPath } from 'node:url'
import { createDb } from '../db/client'
import { runMigrations } from '../db/migrate'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url))

/** Base SQLite en memoria con todas las migraciones aplicadas. */
export function createTestDb() {
  const db = createDb(':memory:')
  runMigrations(db, { migrationsDir: MIGRATIONS_DIR })
  return db
}
