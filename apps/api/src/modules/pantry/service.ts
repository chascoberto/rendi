import { BULK_LEVELS, type StockMode } from '@rendi/shared'
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { DbOrTx } from '../../db/client'
import { locations, stockItems, stockMovements } from '../../db/schema'
import { badRequest, notFound } from '../../lib/errors'

export function listLocations(db: DbOrTx, householdId: string) {
  return db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.householdId, householdId))
    .orderBy(asc(locations.sortOrder))
    .all()
}

/** Verifica que la ubicación pertenezca al hogar. */
export function assertLocation(db: DbOrTx, householdId: string, locationId: string) {
  const loc = db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.householdId, householdId)))
    .get()
  if (!loc) throw notFound('Ubicación no encontrada')
}

/** Stock total de un producto (envases en `unit`, nivel 0-2 en `bulk`) y cantidad de lotes con stock. */
export function getStockSummary(db: DbOrTx, productId: string) {
  const row = db
    .select({
      total: sql<number>`coalesce(sum(${stockItems.quantity}), 0)`,
      lots: sql<number>`count(*) filter (where ${stockItems.quantity} > 0)`,
    })
    .from(stockItems)
    .where(eq(stockItems.productId, productId))
    .get()
  return { total: row?.total ?? 0, lots: row?.lots ?? 0 }
}

/** Orden FEFO: primero el lote que vence antes; los sin vencimiento al final, y luego el más antiguo. */
export const fefoOrder = [
  sql`${stockItems.expiresOn} IS NULL`,
  asc(stockItems.expiresOn),
  asc(stockItems.addedAt),
] as const

/** Stock total y próximo vencimiento de varios productos (los que no tienen stock no aparecen). */
export function getStockTotals(db: DbOrTx, productIds: string[]) {
  const totals = new Map<string, { total: number; nextExpiry: string | null }>()
  if (productIds.length === 0) return totals
  const rows = db
    .select({
      productId: stockItems.productId,
      total: sql<number>`sum(${stockItems.quantity})`,
      nextExpiry: sql<string | null>`min(${stockItems.expiresOn})`,
    })
    .from(stockItems)
    .where(and(inArray(stockItems.productId, productIds), gt(stockItems.quantity, 0)))
    .groupBy(stockItems.productId)
    .all()
  for (const r of rows) totals.set(r.productId, { total: r.total, nextExpiry: r.nextExpiry })
  return totals
}

/** Lotes con stock de un producto, en orden FEFO, con el nombre de su ubicación. */
export function listLots(db: DbOrTx, productId: string) {
  return db
    .select({
      id: stockItems.id,
      quantity: stockItems.quantity,
      expiresOn: stockItems.expiresOn,
      openedAt: stockItems.openedAt,
      addedAt: stockItems.addedAt,
      locationId: stockItems.locationId,
      locationName: locations.name,
    })
    .from(stockItems)
    .innerJoin(locations, eq(locations.id, stockItems.locationId))
    .where(and(eq(stockItems.productId, productId), gt(stockItems.quantity, 0)))
    .orderBy(...fefoOrder)
    .all()
}

/**
 * Adapta el stock al cambiar el modo de un producto. Debe correr en la misma transacción
 * que el cambio de `products.stock_mode`:
 * - `unit → bulk` (antes de cambiar el modo): consolida los lotes en uno, con nivel "Hay"
 *   si había stock o "Se acabó" si no. Conserva el lote que vence primero.
 * - `bulk → unit` (después de cambiar el modo): el nivel no se puede traducir a envases,
 *   así que se exige `unitCount` si había stock.
 */
export function convertStockMode(
  tx: DbOrTx,
  input: {
    productId: string
    from: StockMode
    to: StockMode
    unitCount?: number
    fallbackLocationId: string | null
    userId: string | null
  },
) {
  if (input.from === input.to) return
  const lots = tx
    .select()
    .from(stockItems)
    .where(eq(stockItems.productId, input.productId))
    .orderBy(...fefoOrder)
    .all()
  const actionId = uuidv7()
  const record = (stockItemId: string, delta: number) => {
    if (delta !== 0) {
      tx.insert(stockMovements)
        .values({
          actionId,
          productId: input.productId,
          stockItemId,
          delta,
          reason: 'adjust',
          userId: input.userId,
        })
        .run()
    }
  }

  if (input.to === 'bulk') {
    const total = lots.reduce((sum, l) => sum + l.quantity, 0)
    const [keep, ...rest] = lots
    for (const lot of rest) {
      record(lot.id, -lot.quantity)
      tx.delete(stockItems).where(eq(stockItems.id, lot.id)).run()
    }
    if (keep) {
      const level = total > 0 ? BULK_LEVELS.full : BULK_LEVELS.empty
      record(keep.id, level - keep.quantity)
      tx.update(stockItems).set({ quantity: level }).where(eq(stockItems.id, keep.id)).run()
    }
    return
  }

  // bulk → unit: a lo más un lote (garantizado por los triggers).
  const lot = lots[0]
  const hadStock = (lot?.quantity ?? 0) > 0
  if (hadStock && input.unitCount === undefined) {
    throw badRequest('unit_count_required', 'Indica cuántas unidades hay al pasar a envases')
  }
  const count = input.unitCount ?? 0
  if (lot) {
    record(lot.id, count - lot.quantity)
    tx.update(stockItems).set({ quantity: count }).where(eq(stockItems.id, lot.id)).run()
  } else if (count > 0) {
    if (!input.fallbackLocationId) {
      throw badRequest('location_required', 'Elige una ubicación por defecto para el producto')
    }
    const [created] = tx
      .insert(stockItems)
      .values({ productId: input.productId, locationId: input.fallbackLocationId, quantity: count })
      .returning()
      .all()
    record(created!.id, count)
  }
}
