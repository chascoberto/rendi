/**
 * Acciones sobre el stock: usé uno, se acabó, compré, nivel a granel, ajuste de un lote y deshacer.
 * Cada acción agrupa sus movimientos bajo un `actionId` que la UI ofrece deshacer durante unos segundos.
 */
import {
  BULK_LEVELS,
  isValidStockQuantity,
  type BulkLevel,
  type CalendarDate,
  type LotTarget,
  type LotUpdateInput,
  type PurchaseInput,
} from '@rendi/shared'
import { and, asc, eq, gt, isNotNull, isNull, lte } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { DbOrTx } from '../../db/client'
import { locations, stockItems, stockMovements } from '../../db/schema'
import { AppError, badRequest, notFound } from '../../lib/errors'
import { getProductRef, listProductRefs, type ProductRef } from '../catalog/products'
import { syncMinStockItem } from '../shopping/auto'
import { assertLocation, fefoOrder, getStockSummary, listLocations } from './service'

/** El servidor acepta deshacer por un rato más que el toast, por si la red tarda. */
export const UNDO_WINDOW_MS = 10 * 60_000

type Reason = (typeof stockMovements.$inferInsert)['reason']
type Lot = typeof stockItems.$inferSelect

export interface Actor {
  householdId: string
  userId: string
}

/** Stock actual del producto, tras re-evaluar su ítem automático en la lista de compras. */
function settle(tx: DbOrTx, householdId: string, product: ProductRef) {
  const stock = getStockSummary(tx, product.id)
  syncMinStockItem(tx, householdId, product, stock.total)
  return stock
}

/**
 * Acumula los movimientos de una acción. `actionId` queda en null si nada cambió.
 * `purchaseId` enlaza los movimientos con una compra finalizada desde la lista.
 */
function createAction(
  tx: DbOrTx,
  actor: Actor,
  product: ProductRef,
  purchaseId: string | null = null,
) {
  const productId = product.id
  const actionId = uuidv7()
  let changed = false
  return {
    /** Deja el lote en `quantity` y registra el movimiento (si hay diferencia). */
    set(lot: Pick<Lot, 'id' | 'quantity'>, quantity: number, reason: Reason) {
      const delta = quantity - lot.quantity
      if (delta === 0) return
      tx.update(stockItems).set({ quantity }).where(eq(stockItems.id, lot.id)).run()
      tx.insert(stockMovements)
        .values({
          actionId,
          productId,
          stockItemId: lot.id,
          delta,
          reason,
          userId: actor.userId,
          purchaseId,
        })
        .run()
      changed = true
    },
    result() {
      return { actionId: changed ? actionId : null, stock: settle(tx, actor.householdId, product) }
    },
  }
}

function productLots(tx: DbOrTx, productId: string, onlyWithStock = true) {
  return tx
    .select()
    .from(stockItems)
    .where(
      and(
        eq(stockItems.productId, productId),
        onlyWithStock ? gt(stockItems.quantity, 0) : undefined,
      ),
    )
    .orderBy(...fefoOrder)
    .all()
}

/** Lote de un producto; 404 si no existe o es de otro producto. */
function findLot(tx: DbOrTx, productId: string, lotId: string) {
  const lot = tx
    .select()
    .from(stockItems)
    .where(and(eq(stockItems.id, lotId), eq(stockItems.productId, productId)))
    .get()
  if (!lot) throw notFound('Lote no encontrado')
  return lot
}

/** Ubicación para stock nuevo: la indicada, la del producto o la primera del hogar. */
function resolveLocation(tx: DbOrTx, actor: Actor, product: ProductRef, locationId: string | null) {
  if (locationId) {
    assertLocation(tx, actor.householdId, locationId)
    return locationId
  }
  const fallback = product.defaultLocationId ?? listLocations(tx, actor.householdId)[0]?.id
  if (!fallback) throw badRequest('location_required', 'El hogar no tiene ubicaciones')
  return fallback
}

function insertLot(
  tx: DbOrTx,
  values: { productId: string; locationId: string; expiresOn?: CalendarDate | null },
) {
  const [lot] = tx
    .insert(stockItems)
    .values({ ...values, quantity: 0 })
    .returning()
    .all()
  return lot!
}

function assertUnitMode(product: ProductRef) {
  if (product.stockMode === 'bulk') {
    throw badRequest('bulk_has_levels', 'A granel se indica el nivel: hay, queda poco o se acabó')
  }
}

/** "Usé uno": descuenta un envase del lote indicado o del que vence primero (FEFO). */
export function consumeOne(db: DbOrTx, actor: Actor, productId: string, target: LotTarget) {
  return db.transaction((tx) => {
    const product = getProductRef(tx, actor.householdId, productId)
    assertUnitMode(product)
    const lot = target.lotId ? findLot(tx, productId, target.lotId) : productLots(tx, productId)[0]
    if (!lot || lot.quantity <= 0) {
      throw new AppError(409, 'out_of_stock', 'No queda stock de este producto')
    }
    const action = createAction(tx, actor, product)
    action.set(lot, lot.quantity - 1, 'consume')
    return action.result()
  })
}

/** "Se acabó": deja en cero el lote indicado o todos los del producto (a granel: nivel "Se acabó"). */
export function deplete(db: DbOrTx, actor: Actor, productId: string, target: LotTarget) {
  return db.transaction((tx) => {
    const product = getProductRef(tx, actor.householdId, productId)
    const lots = target.lotId ? [findLot(tx, productId, target.lotId)] : productLots(tx, productId)
    const action = createAction(tx, actor, product)
    for (const lot of lots) action.set(lot, BULK_LEVELS.empty, 'depleted')
    return action.result()
  })
}

/**
 * "Compré". En `unit` suma envases a un lote igual (misma ubicación y vencimiento, sin abrir)
 * o crea uno nuevo. En `bulk` deja el único lote en "Hay". `purchaseId`: compra de la lista.
 */
export function purchase(
  db: DbOrTx,
  actor: Actor,
  productId: string,
  input: PurchaseInput,
  purchaseId: string | null = null,
) {
  return db.transaction((tx) => {
    const product = getProductRef(tx, actor.householdId, productId)
    const action = createAction(tx, actor, product, purchaseId)

    if (product.stockMode === 'bulk') {
      const lot =
        productLots(tx, productId, false)[0] ??
        insertLot(tx, {
          productId,
          locationId: resolveLocation(tx, actor, product, input.locationId),
        })
      action.set(lot, BULK_LEVELS.full, 'purchase')
      return action.result()
    }

    const locationId = resolveLocation(tx, actor, product, input.locationId)
    const lot =
      tx
        .select()
        .from(stockItems)
        .where(
          and(
            eq(stockItems.productId, productId),
            eq(stockItems.locationId, locationId),
            input.expiresOn === null
              ? isNull(stockItems.expiresOn)
              : eq(stockItems.expiresOn, input.expiresOn),
            isNull(stockItems.openedAt),
          ),
        )
        .orderBy(asc(stockItems.addedAt))
        .get() ?? insertLot(tx, { productId, locationId, expiresOn: input.expiresOn })
    action.set(lot, lot.quantity + input.quantity, 'purchase')
    return action.result()
  })
}

/** Nivel de un producto a granel (Hay / Queda poco / Se acabó). */
export function setBulkLevel(db: DbOrTx, actor: Actor, productId: string, level: BulkLevel) {
  return db.transaction((tx) => {
    const product = getProductRef(tx, actor.householdId, productId)
    if (product.stockMode !== 'bulk') {
      throw badRequest('unit_has_count', 'Este producto se cuenta por envases')
    }
    const action = createAction(tx, actor, product)
    let lot = productLots(tx, productId, false)[0]
    if (!lot) {
      if (level === BULK_LEVELS.empty) return action.result()
      lot = insertLot(tx, { productId, locationId: resolveLocation(tx, actor, product, null) })
    }
    const reason: Reason =
      level === BULK_LEVELS.empty ? 'depleted' : level < lot.quantity ? 'consume' : 'adjust'
    action.set(lot, level, reason)
    return action.result()
  })
}

/** Ajuste manual de un lote: cantidad (según el modo), vencimiento o ubicación. */
export function updateLot(db: DbOrTx, actor: Actor, lotId: string, input: LotUpdateInput) {
  return db.transaction((tx) => {
    const lot = tx.select().from(stockItems).where(eq(stockItems.id, lotId)).get()
    if (!lot) throw notFound('Lote no encontrado')
    const product = getProductRef(tx, actor.householdId, lot.productId)
    if (input.locationId) assertLocation(tx, actor.householdId, input.locationId)
    if (input.quantity !== undefined && !isValidStockQuantity(product.stockMode, input.quantity)) {
      throw badRequest('invalid_quantity', 'A granel solo se admite hay, queda poco o se acabó')
    }

    const { quantity, ...fields } = input
    if (Object.keys(fields).length > 0) {
      tx.update(stockItems).set(fields).where(eq(stockItems.id, lotId)).run()
    }
    const action = createAction(tx, actor, product)
    if (quantity !== undefined) action.set(lot, quantity, 'adjust')
    return action.result()
  })
}

/**
 * Deshace una acción revirtiendo sus movimientos. Si el stock cambió después y el resultado
 * ya no es válido (p. ej. quedaría negativo), responde 409 y hay que ajustar a mano.
 */
export function undoAction(db: DbOrTx, actor: Actor, actionId: string) {
  return db.transaction((tx) => {
    const moves = tx
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.actionId, actionId), isNull(stockMovements.undoneAt)))
      .all()
    if (moves.length === 0) throw notFound('No hay nada que deshacer')
    const productId = moves[0]!.productId
    const product = getProductRef(tx, actor.householdId, productId)
    if (Date.now() - moves[0]!.createdAt.getTime() > UNDO_WINDOW_MS) {
      throw new AppError(409, 'undo_expired', 'Ya pasó mucho tiempo para deshacer esta acción')
    }

    const conflict = () =>
      new AppError(409, 'undo_conflict', 'El stock cambió después; ajústalo a mano')
    for (const move of moves) {
      if (!move.stockItemId) throw conflict()
      const lot = tx.select().from(stockItems).where(eq(stockItems.id, move.stockItemId)).get()
      const quantity = (lot?.quantity ?? 0) - move.delta
      if (!lot || !isValidStockQuantity(product.stockMode, quantity)) throw conflict()
      tx.update(stockItems).set({ quantity }).where(eq(stockItems.id, lot.id)).run()
    }
    tx.update(stockMovements)
      .set({ undoneAt: new Date() })
      .where(and(eq(stockMovements.actionId, actionId), isNull(stockMovements.undoneAt)))
      .run()
    return { stock: settle(tx, actor.householdId, product) }
  })
}

/** Lotes con stock que vencen hasta `until` (incluye los ya vencidos), del más urgente al menos. */
export function listExpiring(db: DbOrTx, householdId: string, until: CalendarDate) {
  const lots = db
    .select({
      lotId: stockItems.id,
      productId: stockItems.productId,
      quantity: stockItems.quantity,
      expiresOn: stockItems.expiresOn,
      locationName: locations.name,
    })
    .from(stockItems)
    .innerJoin(locations, eq(locations.id, stockItems.locationId))
    .where(
      and(
        eq(locations.householdId, householdId),
        gt(stockItems.quantity, 0),
        isNotNull(stockItems.expiresOn),
        lte(stockItems.expiresOn, until),
      ),
    )
    .orderBy(asc(stockItems.expiresOn), asc(stockItems.addedAt))
    .all()
  const products = listProductRefs(db, householdId, [...new Set(lots.map((l) => l.productId))])
  return lots.flatMap((lot) => {
    const product = products.get(lot.productId)
    return product ? [{ ...lot, expiresOn: lot.expiresOn!, product }] : []
  })
}
