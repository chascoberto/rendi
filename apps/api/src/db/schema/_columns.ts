import { integer, text } from 'drizzle-orm/sqlite-core'
import { v7 as uuidv7 } from 'uuid'

/** Id UUIDv7 (ordenable por tiempo). Puede venir del cliente, p. ej. desde la cola offline. */
export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => uuidv7())

/** Instante en ms UTC, expuesto como `Date`. */
export const timestamp = () => integer({ mode: 'timestamp_ms' })

export const createdAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date())

export const updatedAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())

/** Fecha de calendario `YYYY-MM-DD` en hora de Chile (vencimientos, semanas). */
export const calendarDate = () => text()
