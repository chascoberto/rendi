import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { Db } from './client'

interface Journal {
  entries: { tag: string }[]
}

/** Cantidad de migraciones ya aplicadas (0 si la base es nueva). */
function appliedCount(db: Db): number {
  const table = db.$client
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
    )
    .get()
  if (!table) return 0
  const row = db.$client.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as {
    n: number
  }
  return row.n
}

export interface MigrateOptions {
  migrationsDir: string
  /** Si se indica y hay migraciones pendientes sobre una base con datos, respalda antes con VACUUM INTO. */
  backupDir?: string
}

/** Aplica las migraciones pendientes. Devuelve cuántas se aplicaron. */
export function runMigrations(db: Db, { migrationsDir, backupDir }: MigrateOptions): number {
  const journalPath = join(migrationsDir, 'meta', '_journal.json')
  if (!existsSync(journalPath)) {
    throw new Error(`No se encontraron migraciones en ${migrationsDir}`)
  }
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal
  const before = appliedCount(db)
  const pending = journal.entries.length - before
  if (pending <= 0) return 0

  if (backupDir && before > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const target = join(backupDir, `pre-migration-${stamp}.db`)
    db.$client.prepare('VACUUM INTO ?').run(target)
    console.log(`Respaldo previo a migrar: ${target}`)
  }

  migrate(db, { migrationsFolder: migrationsDir })
  return pending
}
