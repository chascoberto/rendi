import type {
  ListItemCheckInput,
  ListItemCreateInput,
  ListItemUpdateInput,
  PurchaseFinalizeInput,
} from '@rendi/shared'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { DbOrTx } from '../../db/client'
import { purchases, shoppingListItems, supermarkets } from '../../db/schema'
import { AppError, badRequest, notFound } from '../../lib/errors'
import { getFood, listFoodsByIds } from '../catalog/foods'
import { getProductRef, listProductRefs } from '../catalog/products'
import { listUsers } from '../household/service'
import { getStockTotals } from '../pantry/service'
import { purchase as addPurchaseToStock, type Actor } from '../pantry/stock'

type ItemRow = typeof shoppingListItems.$inferSelect

export function listSupermarkets(db: DbOrTx) {
  return db
    .select({
      id: supermarkets.id,
      name: supermarkets.name,
      isWholesale: supermarkets.isWholesale,
    })
    .from(supermarkets)
    .where(eq(supermarkets.active, true))
    .orderBy(asc(supermarkets.sortOrder))
    .all()
}

/** Ítems con nombre, categoría, stock actual (si son productos) y quién los marcó. */
function present(db: DbOrTx, householdId: string, rows: ItemRow[]) {
  const productIds = rows.flatMap((r) => r.productId ?? [])
  const products = listProductRefs(db, householdId, productIds, { includeArchived: true })
  const foods = listFoodsByIds(
    db,
    householdId,
    rows.flatMap((r) => r.foodId ?? []),
  )
  const stock = getStockTotals(db, productIds)
  const users = listUsers(db, householdId)
  const person = (userId: string | null) => {
    const u = userId ? users.get(userId) : undefined
    return u ? { userId: u.userId, name: u.name, avatarEmoji: u.avatarEmoji } : null
  }

  return rows.map((r) => {
    const product = r.productId ? products.get(r.productId) : undefined
    const food = r.foodId ? foods.get(r.foodId) : undefined
    return {
      id: r.id,
      source: r.source,
      quantity: r.quantity,
      note: r.note,
      name: product?.name ?? food?.name ?? r.freeText ?? '',
      categoryId: product?.categoryId ?? food?.categoryId ?? null,
      productId: r.productId,
      foodId: r.foodId,
      product: product
        ? {
            brand: product.brand,
            contentAmount: product.contentAmount,
            contentUnit: product.contentUnit,
            stockMode: product.stockMode,
            minStock: product.minStock,
            stock: stock.get(product.id)?.total ?? 0,
          }
        : null,
      checked: r.checkedAt !== null,
      checkedBy: person(r.checkedBy),
      checkUpdatedAt: r.checkUpdatedAt?.getTime() ?? null,
      addedBy: person(r.addedBy),
      createdAt: r.createdAt.getTime(),
    }
  })
}

export type ListItem = ReturnType<typeof present>[number]

const openItems = (householdId: string) =>
  and(eq(shoppingListItems.householdId, householdId), isNull(shoppingListItems.purchaseId))

/** La lista del hogar: los ítems que aún no se compran, del más antiguo al más nuevo. */
export function listItems(db: DbOrTx, householdId: string) {
  const rows = db
    .select()
    .from(shoppingListItems)
    .where(openItems(householdId))
    .orderBy(asc(shoppingListItems.createdAt), asc(shoppingListItems.id))
    .all()
  return present(db, householdId, rows)
}

function findOpenItem(db: DbOrTx, householdId: string, itemId: string) {
  const row = db
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.id, itemId), openItems(householdId)))
    .get()
  if (!row) throw notFound('El ítem ya no está en la lista')
  return row
}

export function addItem(db: DbOrTx, actor: Actor, input: ListItemCreateInput) {
  return db.transaction((tx) => {
    const { householdId } = actor
    if (input.productId) {
      const product = getProductRef(tx, householdId, input.productId)
      if (product.archivedAt) throw badRequest('product_archived', 'El producto está archivado')
    }
    if (input.foodId) getFood(tx, householdId, input.foodId)

    const target = input.productId
      ? eq(shoppingListItems.productId, input.productId)
      : input.foodId
        ? eq(shoppingListItems.foodId, input.foodId)
        : undefined
    if (
      target &&
      tx
        .select()
        .from(shoppingListItems)
        .where(and(openItems(householdId), target))
        .get()
    ) {
      throw new AppError(409, 'already_listed', 'Ya está en la lista')
    }

    const [row] = tx
      .insert(shoppingListItems)
      .values({
        householdId,
        productId: input.productId ?? null,
        foodId: input.foodId ?? null,
        freeText: input.freeText ?? null,
        quantity: input.quantity,
        note: input.note,
        source: 'manual',
        addedBy: actor.userId,
      })
      .returning()
      .all()
    return present(tx, householdId, [row!])[0]!
  })
}

export function updateItem(
  db: DbOrTx,
  householdId: string,
  itemId: string,
  input: ListItemUpdateInput,
) {
  findOpenItem(db, householdId, itemId)
  const [row] = db
    .update(shoppingListItems)
    .set(input)
    .where(eq(shoppingListItems.id, itemId))
    .returning()
    .all()
  return present(db, householdId, [row!])[0]!
}

/**
 * Quita un ítem. Si era automático y el producto sigue bajo el mínimo, volverá a aparecer
 * con el próximo movimiento de stock.
 */
export function deleteItem(db: DbOrTx, householdId: string, itemId: string) {
  findOpenItem(db, householdId, itemId)
  db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId)).run()
}

/**
 * Marca o desmarca con "última escritura gana" según el instante del cliente. Un `at` más
 * antiguo que el último registrado se ignora (`applied: false`). Un `at` futuro se limita a
 * ahora, para que un reloj adelantado no bloquee los cambios de los demás.
 */
export function checkItem(db: DbOrTx, actor: Actor, itemId: string, input: ListItemCheckInput) {
  return db.transaction((tx) => {
    const row = findOpenItem(tx, actor.householdId, itemId)
    const at = Math.min(input.at, Date.now())
    if (row.checkUpdatedAt && at <= row.checkUpdatedAt.getTime()) {
      return { applied: false, item: present(tx, actor.householdId, [row])[0]! }
    }
    const [updated] = tx
      .update(shoppingListItems)
      .set({
        checkedAt: input.checked ? new Date(at) : null,
        checkedBy: input.checked ? actor.userId : null,
        checkUpdatedAt: new Date(at),
      })
      .where(eq(shoppingListItems.id, itemId))
      .returning()
      .all()
    return { applied: true, item: present(tx, actor.householdId, [updated!])[0]! }
  })
}

/**
 * Finaliza la compra de quien la pide: solo los ítems que marcó esa persona. Se crea la compra,
 * los ítems salen de la lista y los productos pasan al stock (`quantities[itemId]`, o la cantidad
 * del ítem, o 1). Lo marcado por otros y lo no marcado sigue en la lista.
 */
export function finalizePurchase(db: DbOrTx, actor: Actor, input: PurchaseFinalizeInput) {
  return db.transaction((tx) => {
    const market = tx
      .select({ id: supermarkets.id })
      .from(supermarkets)
      .where(and(eq(supermarkets.id, input.supermarketId), eq(supermarkets.active, true)))
      .get()
    if (!market) throw badRequest('invalid_supermarket', 'Supermercado desconocido')

    const items = tx
      .select()
      .from(shoppingListItems)
      .where(and(openItems(actor.householdId), eq(shoppingListItems.checkedBy, actor.userId)))
      .all()
    if (items.length === 0) {
      throw badRequest('nothing_checked', 'No has marcado nada en la lista')
    }

    const [created] = tx
      .insert(purchases)
      .values({
        householdId: actor.householdId,
        supermarketId: market.id,
        userId: actor.userId,
        purchasedAt: new Date(),
      })
      .returning()
      .all()
    const purchaseId = created!.id
    // Primero se cierran los ítems: así, si tras la compra el producto sigue bajo el mínimo,
    // la regla automática agrega un ítem nuevo en vez de ver el que se está comprando.
    for (const item of items) {
      tx.update(shoppingListItems)
        .set({ purchaseId })
        .where(eq(shoppingListItems.id, item.id))
        .run()
    }

    const products = listProductRefs(
      tx,
      actor.householdId,
      items.flatMap((i) => i.productId ?? []),
    )
    let stocked = 0
    for (const item of items) {
      if (!item.productId || !products.has(item.productId)) continue
      const quantity = input.quantities[item.id] ?? item.quantity ?? 1
      addPurchaseToStock(
        tx,
        actor,
        item.productId,
        { quantity, expiresOn: null, locationId: null },
        purchaseId,
      )
      stocked++
    }
    return { purchase: { id: purchaseId, supermarketId: market.id, items: items.length, stocked } }
  })
}
