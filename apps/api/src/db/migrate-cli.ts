import { dirname } from 'node:path'
import { env } from '../env'
import { createDb } from './client'
import { runMigrations } from './migrate'

const db = createDb(env.DATABASE_PATH)
const applied = runMigrations(db, {
  migrationsDir: env.MIGRATIONS_DIR,
  backupDir: dirname(env.DATABASE_PATH),
})
console.log(applied > 0 ? `Migraciones aplicadas: ${applied}` : 'La base ya está al día.')
db.$client.close()
