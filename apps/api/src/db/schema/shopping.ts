import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createdAt, id, timestamp } from './_columns'
import { foods, products } from './catalog'
import { households, users } from './household'
import { supermarkets } from './supermarkets'

/** Una compra finalizada: quién, dónde y cuándo. Enlaza ítems de la lista y movimientos de stock. */
export const purchases = sqliteTable(
  'purchases',
  {
    id: id(),
    householdId: text()
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    supermarketId: text()
      .notNull()
      .references(() => supermarkets.id, { onDelete: 'restrict' }),
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    purchasedAt: timestamp().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('purchases_household_idx').on(t.householdId, t.purchasedAt)],
)

/**
 * Ítems de la lista de compras permanente del hogar. Un ítem está "en la lista" mientras
 * `purchaseId` es null; al finalizar una compra se le asigna y deja de mostrarse.
 */
export const shoppingListItems = sqliteTable(
  'shopping_list_items',
  {
    id: id(),
    householdId: text()
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    productId: text().references(() => products.id, { onDelete: 'cascade' }),
    foodId: text().references(() => foods.id, { onDelete: 'cascade' }),
    freeText: text(),
    quantity: integer(),
    note: text(),
    source: text({ enum: ['manual', 'min_stock', 'menu', 'lunchbox'] }).notNull(),
    /** Referencia al origen (p. ej. entrada del menú) para fases futuras. */
    sourceRef: text(),
    /** Supermercado asignado al dividir la compra (Fase 4). */
    supermarketId: text().references(() => supermarkets.id, { onDelete: 'set null' }),
    checkedAt: timestamp(),
    checkedBy: text().references(() => users.id, { onDelete: 'set null' }),
    /**
     * Momento (según el cliente) del último marcar/desmarcar. La cola offline sincroniza
     * "estado en el instante T": gana la escritura con el valor más reciente.
     */
    checkUpdatedAt: timestamp(),
    purchaseId: text().references(() => purchases.id, { onDelete: 'set null' }),
    addedBy: text().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('shopping_list_items_open_idx').on(t.householdId, t.purchaseId),
    // Un solo ítem automático abierto por producto.
    uniqueIndex('shopping_list_items_min_stock_uq')
      .on(t.householdId, t.productId)
      .where(sql`${t.source} = 'min_stock' AND ${t.purchaseId} IS NULL`),
    check(
      'shopping_list_items_target_check',
      sql`(${t.productId} IS NOT NULL) + (${t.foodId} IS NOT NULL) + (${t.freeText} IS NOT NULL) = 1`,
    ),
    check(
      'shopping_list_items_source_check',
      sql`${t.source} IN ('manual', 'min_stock', 'menu', 'lunchbox')`,
    ),
    check('shopping_list_items_quantity_check', sql`${t.quantity} IS NULL OR ${t.quantity} >= 1`),
  ],
)
