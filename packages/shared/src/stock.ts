import { z } from 'zod'

/**
 * Modo de conteo de stock de un producto.
 * - `unit`: se cuentan envases/paquetes enteros ("usé uno" descuenta un envase).
 *   Si se quiere contar piezas sueltas (tomates, paltas), el producto va en este modo.
 * - `bulk`: a granel (fruta, verdura suelta); solo existe un nivel: Hay / Queda poco / Se acabó.
 *   Un producto a granel tiene a lo más un lote, y su cantidad es siempre 0, 1 o 2.
 */
export const STOCK_MODES = ['unit', 'bulk'] as const
export type StockMode = (typeof STOCK_MODES)[number]

/**
 * Niveles de un producto a granel. Se guardan como cantidad numérica para que la
 * regla de stock mínimo (`cantidad < mínimo`) sea la misma en ambos modos, pero
 * no son conteos: nunca se suman ni se mezclan con cantidades de productos `unit`.
 */
export const BULK_LEVELS = { empty: 0, low: 1, full: 2 } as const
export type BulkLevel = (typeof BULK_LEVELS)[keyof typeof BULK_LEVELS]

/** Mínimo de un producto a granel con reposición automática: "queda poco" lo agrega a la lista. */
export const BULK_RESTOCK_MIN = BULK_LEVELS.full

export const BULK_LEVEL_LABELS: Record<BulkLevel, string> = {
  0: 'Se acabó',
  1: 'Queda poco',
  2: 'Hay',
}

export const bulkLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2)])

/** Envases enteros, sin fracciones. */
export const unitCountSchema = z.number().int().min(0).max(100_000)

/** Esquema de la cantidad de stock válida según el modo del producto. */
export function stockQuantitySchema(mode: StockMode) {
  return mode === 'bulk' ? bulkLevelSchema : unitCountSchema
}

/**
 * Esquema del stock mínimo según el modo:
 * - `unit`: null (sin reposición automática) o un entero ≥ 1.
 * - `bulk`: null o exactamente `BULK_RESTOCK_MIN` (el switch "agregar cuando quede poco").
 */
export function minStockSchema(mode: StockMode) {
  return mode === 'bulk'
    ? z.literal(BULK_RESTOCK_MIN).nullable()
    : z.number().int().min(1).max(100_000).nullable()
}

export function isValidStockQuantity(mode: StockMode, quantity: number): boolean {
  return stockQuantitySchema(mode).safeParse(quantity).success
}

/** ¿Hay que reponer? Se agrega a la lista cuando el stock queda bajo el mínimo. */
export function isBelowMinimum(quantity: number, minStock: number | null): boolean {
  return minStock !== null && quantity < minStock
}
