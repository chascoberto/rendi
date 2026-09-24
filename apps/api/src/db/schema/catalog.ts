import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { createdAt, id, timestamp, updatedAt } from './_columns'
import { households } from './household'
import { locations } from './pantry'

/** Categorías globales (datos de referencia). El id es un slug estable: 'lacteos', 'abarrotes'… */
export const categories = sqliteTable('categories', {
  id: text().primaryKey(),
  name: text().notNull(),
  icon: text(),
  sortOrder: integer().notNull().default(0),
})

/**
 * Alimento genérico ("leche", "brócoli"). Lo usan las preferencias de los miembros,
 * las recetas (futuro) y la pregunta "¿hay leche?" sumando todos sus productos.
 */
export const foods = sqliteTable(
  'foods',
  {
    id: id(),
    householdId: text()
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    searchText: text().notNull(),
    categoryId: text().references(() => categories.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('foods_household_search_uq').on(t.householdId, t.searchText)],
)

/** Producto concreto (SKU). El stock se cuenta según `stockMode`, ver `@rendi/shared/stock`. */
export const products = sqliteTable(
  'products',
  {
    id: id(),
    householdId: text()
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    brand: text(),
    /** Nombre + marca normalizados para búsqueda sin tildes. */
    searchText: text().notNull(),
    foodId: text().references(() => foods.id, { onDelete: 'set null' }),
    categoryId: text().references(() => categories.id, { onDelete: 'set null' }),
    contentAmount: real().notNull(),
    contentUnit: text({ enum: ['g', 'kg', 'ml', 'L', 'u'] }).notNull(),
    baseUnit: text({ enum: ['g', 'ml', 'u'] }).notNull(),
    baseQuantity: real().notNull(),
    stockMode: text({ enum: ['unit', 'bulk'] })
      .notNull()
      .default('unit'),
    minStock: integer(),
    defaultLocationId: text().references(() => locations.id, { onDelete: 'set null' }),
    archivedAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('products_household_idx').on(t.householdId),
    index('products_food_idx').on(t.foodId),
    check('products_content_unit_check', sql`${t.contentUnit} IN ('g', 'kg', 'ml', 'L', 'u')`),
    check('products_base_unit_check', sql`${t.baseUnit} IN ('g', 'ml', 'u')`),
    check('products_content_positive', sql`${t.contentAmount} > 0 AND ${t.baseQuantity} > 0`),
    check('products_stock_mode_check', sql`${t.stockMode} IN ('unit', 'bulk')`),
    // unit: null o entero ≥ 1 · bulk: null o 2 ("agregar cuando quede poco").
    check(
      'products_min_stock_check',
      sql`${t.minStock} IS NULL
        OR (${t.stockMode} = 'unit' AND ${t.minStock} >= 1 AND ${t.minStock} = CAST(${t.minStock} AS INTEGER))
        OR (${t.stockMode} = 'bulk' AND ${t.minStock} = 2)`,
    ),
  ],
)

/**
 * Códigos de barra de un producto. Un producto puede tener varios, y un EAN de pack
 * (p. ej. Alvi 6 × 1 L) apunta al mismo producto con `packCount` 6.
 */
export const productBarcodes = sqliteTable(
  'product_barcodes',
  {
    householdId: text()
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    ean: text().notNull(),
    productId: text()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    packCount: integer().notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.ean] }),
    index('product_barcodes_product_idx').on(t.productId),
    check(
      'product_barcodes_ean_check',
      sql`length(${t.ean}) IN (8, 12, 13, 14) AND ${t.ean} NOT GLOB '*[^0-9]*'`,
    ),
    check('product_barcodes_pack_count_check', sql`${t.packCount} >= 1`),
  ],
)
