import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { calendarDate, createdAt, id, timestamp } from './_columns'
import { products } from './catalog'
import { households, users } from './household'
import { purchases } from './shopping'

/** Lugares donde se guarda el stock. Cada hogar parte con Despensa, Refrigerador y Congelador. */
export const locations = sqliteTable(
  'locations',
  {
    id: id(),
    householdId: text()
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index('locations_household_idx').on(t.householdId)],
)

/**
 * Lotes de stock. En modo `unit`, cantidad = envases enteros. En modo `bulk`, cantidad = nivel
 * 0/1/2 y a lo más un lote por producto. Los triggers de la migración 0001 lo garantizan.
 * Los lotes en 0 no se borran: así "deshacer" solo tiene que revertir la cantidad.
 */
export const stockItems = sqliteTable(
  'stock_items',
  {
    id: id(),
    productId: text()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    locationId: text()
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    quantity: real().notNull(),
    expiresOn: calendarDate(),
    openedAt: timestamp(),
    addedAt: createdAt(),
  },
  (t) => [
    index('stock_items_product_idx').on(t.productId),
    index('stock_items_expires_idx').on(t.expiresOn),
    check('stock_items_quantity_check', sql`${t.quantity} >= 0`),
    check(
      'stock_items_expires_format',
      sql`${t.expiresOn} IS NULL OR ${t.expiresOn} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`,
    ),
  ],
)

/**
 * Historial de cambios de stock. Una acción rápida puede generar varios movimientos
 * (p. ej. "se acabó" sobre varios lotes); comparten `actionId` para deshacerlos juntos.
 */
export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: id(),
    actionId: text().notNull(),
    productId: text()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    stockItemId: text().references(() => stockItems.id, { onDelete: 'set null' }),
    delta: real().notNull(),
    reason: text({ enum: ['purchase', 'consume', 'depleted', 'adjust', 'receipt'] }).notNull(),
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    purchaseId: text().references(() => purchases.id, { onDelete: 'set null' }),
    undoneAt: timestamp(),
    createdAt: createdAt(),
  },
  (t) => [
    index('stock_movements_product_idx').on(t.productId, t.createdAt),
    index('stock_movements_action_idx').on(t.actionId),
    check(
      'stock_movements_reason_check',
      sql`${t.reason} IN ('purchase', 'consume', 'depleted', 'adjust', 'receipt')`,
    ),
  ],
)
