import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Supermercados (datos de referencia globales). El id es un slug estable: 'lider', 'alvi'… */
export const supermarkets = sqliteTable('supermarkets', {
  id: text().primaryKey(),
  name: text().notNull(),
  hasOnlinePrices: integer({ mode: 'boolean' }).notNull().default(false),
  /** Vende en formatos mayoristas/packs: comparar siempre por precio unitario. */
  isWholesale: integer({ mode: 'boolean' }).notNull().default(false),
  websiteUrl: text(),
  sortOrder: integer().notNull().default(0),
  active: integer({ mode: 'boolean' }).notNull().default(true),
})
